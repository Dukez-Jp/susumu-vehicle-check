using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Services;

public sealed class UserAdminService(SusumuDbContext db, IPasswordHashing hashing, IClock clock)
{
    public async Task<IReadOnlyList<UserDto>> ListAsync(CurrentUser actor, CancellationToken ct)
    {
        RequireAdministrator(actor);

        var users = await db.Users.AsNoTracking().InScope(actor)
            .OrderBy(u => u.Name)
            .ToListAsync(ct);

        return users.Select(u => u.ToDto()).ToList();
    }

    public async Task<UserDto> CreateAsync(CurrentUser actor, CreateUserRequest request, CancellationToken ct)
    {
        RequireAdministrator(actor);

        var name = (request.Name ?? string.Empty).Trim();
        var username = (request.Username ?? string.Empty).Trim().ToLowerInvariant();

        var errors = new Dictionary<string, string[]>();
        if (name.Length is 0 or > 200)
        {
            errors["name"] = ["Required, at most 200 characters."];
        }

        if (username.Length is < 3 or > 120 || username.Any(char.IsWhiteSpace))
        {
            errors["username"] = ["Required, 3 to 120 characters, no spaces."];
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation("Invalid user payload.", errors);
        }

        // A missing role must never fall through to the zero enum member, which is Administrator.
        if (request.Role is not { } role || !Enum.IsDefined(role))
        {
            throw AppException.Validation("Invalid user payload.",
                new Dictionary<string, string[]>
                {
                    ["role"] = ["Required; one of Administrator, Supervisor, Inspector, Office."],
                });
        }

        hashing.EnsureAcceptable(request.Password);

        if (await db.Users.AnyAsync(u => u.Username == username, ct))
        {
            throw AppException.Conflict($"Username '{username}' is already taken.");
        }

        // Same company-wide serialization the organization administration uses, so a new account
        // cannot land in a location that is being deactivated in a concurrent request.
        await using var transaction = await OrganizationAdministrationService.BeginCompanyWriteAsync(
            db, actor.CompanyId, ct);
        await OrganizationAdministrationService.RequireActiveAdministratorAsync(db, actor, ct);

        var locationId = await ResolveLocationAsync(actor, request.LocationId, ct);
        var now = clock.UtcNow;

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            CompanyId = actor.CompanyId,
            LocationId = locationId,
            Name = name,
            Username = username,
            PasswordHash = hashing.Hash(request.Password!),
            Role = role,
            Active = true,
            SecurityStamp = NewSecurityStamp(),
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.Users.Add(user);
        db.AuditEntries.Add(Audit.Entry(now, actor.Id, actor.CompanyId, AuditActions.UserCreated, "user", user.Id,
            details: $"username={user.Username}; role={user.Role}"));

        // Creating an administrator participates in the same serialization as demoting one.
        await BumpAdministrationStampAsync(actor.CompanyId, ct);

        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw AppException.Conflict(
                "Another account change for this company was applied at the same time. Reload and try again.");
        }
        catch (DbUpdateException)
        {
            throw AppException.Conflict($"Username '{username}' is already taken.");
        }

        return user.ToDto();
    }

    public async Task<UserDto> UpdateAsync(CurrentUser actor, Guid id, UpdateUserRequest request, CancellationToken ct)
    {
        RequireAdministrator(actor);

        await using var transaction = await OrganizationAdministrationService.BeginCompanyWriteAsync(
            db, actor.CompanyId, ct);
        await OrganizationAdministrationService.RequireActiveAdministratorAsync(db, actor, ct);

        var user = await db.Users.InScope(actor).FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw AppException.NotFound($"User {id} was not found in your scope.");

        if (request.Active ?? user.Active)
        {
            // Reactivation may omit locationId; validate the persisted association under the lock.
            await ResolveLocationAsync(actor, user.LocationId, ct);
        }

        var now = clock.UtcNow;
        var revokeSessions = false;

        if (request.Name is not null)
        {
            var name = request.Name.Trim();
            if (name.Length is 0 or > 200)
            {
                throw AppException.Validation("Invalid user payload.",
                    new Dictionary<string, string[]> { ["name"] = ["Required, at most 200 characters."] });
            }

            user.Name = name;
        }

        if (request.Role is { } requestedRole && !Enum.IsDefined(requestedRole))
        {
            throw AppException.Validation("Invalid user payload.",
                new Dictionary<string, string[]> { ["role"] = ["Not a defined role."] });
        }

        // Serialize account administration on the company row before reading the administrator count.
        // Without it two administrators can each observe "one other administrator exists" and both
        // demote, leaving the company with none — a write skew a preflight count cannot catch.
        await BumpAdministrationStampAsync(user.CompanyId, ct);

        var losesAdmin = user.Role == UserRole.Administrator &&
                         ((request.Role is { } role && role != UserRole.Administrator) || request.Active == false);

        if (losesAdmin)
        {
            var remainingAdmins = await db.Users.CountAsync(
                u => u.CompanyId == user.CompanyId && u.Role == UserRole.Administrator && u.Active && u.Id != user.Id, ct);

            if (remainingAdmins == 0)
            {
                throw AppException.Conflict(
                    "This is the last active administrator of the company; promote another administrator first.");
            }
        }

        if (request.Role is { } newRole && newRole != user.Role)
        {
            user.Role = newRole;
            revokeSessions = true;
        }

        if (request.Active is { } active && active != user.Active)
        {
            user.Active = active;
            revokeSessions = true;
        }

        if (request.Password is not null)
        {
            hashing.EnsureAcceptable(request.Password);
            user.PasswordHash = hashing.Hash(request.Password);
            revokeSessions = true;
            db.AuditEntries.Add(Audit.Entry(now, actor.Id, actor.CompanyId, AuditActions.UserPasswordReset, "user", user.Id));
        }

        if (revokeSessions)
        {
            // Existing access tokens carry the old stamp and stop being accepted immediately.
            user.SecurityStamp = NewSecurityStamp();
        }

        user.UpdatedAt = now;
        db.AuditEntries.Add(Audit.Entry(now, actor.Id, actor.CompanyId, AuditActions.UserUpdated, "user", user.Id,
            details: $"role={user.Role}; active={user.Active}; sessionsRevoked={revokeSessions}"));

        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw AppException.Conflict(
                "Another account change for this company was applied at the same time. Reload and try again.");
        }

        return user.ToDto();
    }

    /// <summary>
    /// Increments the company's administration stamp, which is mapped as a concurrency token. Two
    /// concurrent administrative changes therefore collide on this row and exactly one of them wins.
    /// </summary>
    private async Task BumpAdministrationStampAsync(Guid companyId, CancellationToken ct)
    {
        var company = await db.Companies.FirstOrDefaultAsync(c => c.Id == companyId, ct)
            ?? throw AppException.NotFound("The company of this account no longer exists.");

        company.AdministrationStamp += 1;
    }

    public static string NewSecurityStamp() => Guid.NewGuid().ToString("N");

    private static void RequireAdministrator(CurrentUser actor)
    {
        if (!actor.IsAdministrator)
        {
            throw AppException.Forbidden("Only administrators can manage user accounts.");
        }
    }

    private async Task<Guid> ResolveLocationAsync(CurrentUser actor, Guid? locationId, CancellationToken ct)
    {
        var effectiveLocationId = locationId ?? actor.LocationId;
        var usable = await db.Locations.AnyAsync(
            l => l.Id == effectiveLocationId && l.CompanyId == actor.CompanyId && l.Active, ct);

        if (!usable)
        {
            throw AppException.Validation("locationId does not belong to your company or is not active.",
                new Dictionary<string, string[]> { ["locationId"] = ["Unknown or inactive location."] });
        }

        return effectiveLocationId;
    }
}
