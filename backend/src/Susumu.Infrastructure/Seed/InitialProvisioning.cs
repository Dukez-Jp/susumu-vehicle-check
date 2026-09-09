using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Services;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Seed;

public sealed record ProvisioningRequest(
    string? CompanyName,
    string? LocationName,
    string? AdminName,
    string? AdminUsername,
    string? AdminPassword);

public sealed record ProvisioningResult(Guid CompanyId, Guid LocationId, Guid AdminUserId, string AdminUsername);

/// <summary>
/// Creates the first company, location and administrator of an empty installation from values the
/// operator supplies at run time.
///
/// This exists so a production installation never needs the Development fixture enabled and never
/// needs rows inserted into its database by hand. It refuses to run against a database that already
/// has any user, so it can neither overwrite an existing account nor be used to add a back door to a
/// running system. The password is read from the environment, hashed, and never logged or returned.
/// </summary>
public sealed class InitialProvisioning(SusumuDbContext db, IPasswordHashing hashing, IClock clock)
{
    public async Task<ProvisioningResult> RunAsync(ProvisioningRequest request, CancellationToken ct)
    {
        var companyName = Required(request.CompanyName, "company name");
        var locationName = Required(request.LocationName, "location name");
        var adminName = Required(request.AdminName, "administrator display name");
        var username = Required(request.AdminUsername, "administrator username").ToLowerInvariant();

        if (username.Length > AuthService.MaxUsernameLength || username.Any(char.IsWhiteSpace))
        {
            throw new InvalidOperationException(
                $"The administrator username must be at most {AuthService.MaxUsernameLength} characters and contain no spaces.");
        }

        hashing.EnsureAcceptable(request.AdminPassword);

        if (await db.Users.AnyAsync(ct))
        {
            throw new InvalidOperationException(
                "This database already contains user accounts. Initial provisioning only runs on an empty " +
                "installation; use the administration API to add further accounts.");
        }

        var now = clock.UtcNow;
        var company = new Company
        {
            Id = Guid.NewGuid(),
            Name = companyName,
            Active = true,
            CreatedAt = now,
        };

        var location = new Location
        {
            Id = Guid.NewGuid(),
            CompanyId = company.Id,
            Name = locationName,
            Active = true,
            CreatedAt = now,
        };

        var admin = new AppUser
        {
            Id = Guid.NewGuid(),
            CompanyId = company.Id,
            LocationId = location.Id,
            Name = adminName,
            Username = username,
            PasswordHash = hashing.Hash(request.AdminPassword!),
            Role = UserRole.Administrator,
            Active = true,
            SecurityStamp = UserAdminService.NewSecurityStamp(),
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.Companies.Add(company);
        db.Locations.Add(location);
        db.Users.Add(admin);
        db.AuditEntries.Add(Audit.Entry(
            now, admin.Id, company.Id, AuditActions.InitialProvisioning, "company", company.Id,
            details: $"company={company.Name}; location={location.Name}; administrator={admin.Username}"));

        await db.SaveChangesAsync(ct);

        return new ProvisioningResult(company.Id, location.Id, admin.Id, admin.Username);
    }

    private static string Required(string? value, string description)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            throw new InvalidOperationException($"The {description} is required.");
        }

        if (trimmed.Length > 200)
        {
            throw new InvalidOperationException($"The {description} must be at most 200 characters.");
        }

        return trimmed;
    }
}
