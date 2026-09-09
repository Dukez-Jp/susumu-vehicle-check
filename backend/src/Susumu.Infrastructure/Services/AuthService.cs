using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Services;

public sealed class AuthService(
    SusumuDbContext db,
    IPasswordHashing hashing,
    ITokenService tokens,
    ILoginThrottle throttle,
    IClock clock)
{
    /// <summary>Matches the stored column, so an oversized username can never overrun the audit row.</summary>
    public const int MaxUsernameLength = 120;

    /// <summary>
    /// Bounded before hashing: PBKDF2 over an unbounded input is a cheap way to burn server CPU.
    /// Kept at or above the limit enforced when a password is created or reset.
    /// </summary>
    public const int MaxPasswordLength = 256;

    /// <summary>
    /// Verified against a real PBKDF2 hash of a value nobody knows, so an unknown username costs the
    /// same work as a known one and cannot be identified by response time.
    /// </summary>
    private static readonly string DecoyHash = new PasswordHashing().Hash(Guid.NewGuid().ToString("N"));

    public async Task<LoginResponse> LoginAsync(LoginRequest request, string clientKey, CancellationToken ct)
    {
        var username = (request.Username ?? string.Empty).Trim().ToLowerInvariant();
        var password = request.Password ?? string.Empty;
        var deviceId = (request.DeviceId ?? string.Empty).Trim();

        var errors = new Dictionary<string, string[]>();
        if (username.Length == 0)
        {
            errors["username"] = ["Required."];
        }
        else if (username.Length > MaxUsernameLength)
        {
            errors["username"] = [$"At most {MaxUsernameLength} characters."];
        }

        if (password.Length == 0)
        {
            errors["password"] = ["Required."];
        }
        else if (password.Length > MaxPasswordLength)
        {
            errors["password"] = [$"At most {MaxPasswordLength} characters."];
        }

        if (deviceId.Length is 0 or > 120)
        {
            errors["deviceId"] = ["Required, at most 120 characters."];
        }

        if (errors.Count > 0)
        {
            // Rejected before hashing and before any audit write, so an oversized field can neither
            // burn CPU nor reach a bounded column. The submitted password is never recorded.
            throw AppException.Validation("Invalid sign-in request.", errors);
        }

        throttle.EnsureNotBlocked(username, clientKey);

        var user = await db.Users
            .Include(u => u.Company)
            .Include(u => u.Location)
            .FirstOrDefaultAsync(u => u.Username == username, ct);

        var passwordOk = hashing.Verify(user?.PasswordHash ?? DecoyHash, password);
        var reason = DenialReason(user, passwordOk);

        if (reason is not null)
        {
            throttle.RegisterFailure(username, clientKey);
            db.AuditEntries.Add(Audit.Entry(
                clock.UtcNow, user?.Id, user?.CompanyId, AuditActions.LoginFailed, "user", user?.Id,
                details: $"username={username}; device={deviceId}; reason={reason}"));
            await db.SaveChangesAsync(ct);

            // Identical answer for every failure reason: no account enumeration through the API.
            throw AppException.Unauthorized("Invalid username or password.");
        }

        throttle.RegisterSuccess(username, clientKey);
        await TouchDeviceAsync(deviceId, user!.Id, ct);

        db.AuditEntries.Add(Audit.Entry(
            clock.UtcNow, user.Id, user.CompanyId, AuditActions.LoginSucceeded, "user", user.Id,
            details: $"device={deviceId}"));
        await db.SaveChangesAsync(ct);

        var (token, expiresAt, offlineUntil) = tokens.Issue(user, deviceId);
        return new LoginResponse(token, expiresAt, offlineUntil, user.ToDto());
    }

    /// <summary>
    /// An account is only usable while the account, its company and its location are all active.
    /// Disabling a company or a workshop must take effect without touching every user row.
    /// </summary>
    private static string? DenialReason(AppUser? user, bool passwordOk) => user switch
    {
        null => "unknown-user",
        _ when !passwordOk => "bad-password",
        { Active: false } => "inactive-user",
        { Company.Active: false } => "inactive-company",
        { Location.Active: false } => "inactive-location",
        _ => null,
    };

    public async Task<BootstrapResponse> BootstrapAsync(CurrentUser actor, CancellationToken ct)
    {
        var user = await db.Users.FirstAsync(u => u.Id == actor.Id, ct);

        var vehicles = await db.Vehicles.AsNoTracking()
            .InScope(actor)
            .Where(v => v.Active)
            .OrderBy(v => v.InternalNumber)
            .ToListAsync(ct);

        var templates = await db.ChecklistTemplates.AsNoTracking()
            .InScope(actor)
            .Where(t => t.Published && t.Active)
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .OrderBy(t => t.VehicleType).ThenBy(t => t.Name).ThenBy(t => t.Version)
            .ToListAsync(ct);

        // Only the newest active published version of each family is offered for new work. Retired
        // versions stay readable through GET /templates so history remains explainable.
        var latest = templates
            .GroupBy(t => (t.VehicleType, t.Name))
            .Select(g => g.OrderByDescending(t => t.Version).First())
            .OrderBy(t => t.VehicleType).ThenBy(t => t.Name)
            .Select(t => t.ToDto())
            .ToList();

        return new BootstrapResponse(
            user.ToDto(),
            vehicles.Select(v => v.ToDto()).ToList(),
            latest,
            clock.UtcNow);
    }

    public async Task TouchDeviceAsync(string deviceId, Guid userId, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var device = await db.Devices.FirstOrDefaultAsync(d => d.DeviceId == deviceId, ct);
        if (device is null)
        {
            db.Devices.Add(new DeviceRecord
            {
                DeviceId = deviceId,
                LastUserId = userId,
                FirstSeenAt = now,
                LastSeenAt = now,
            });
        }
        else
        {
            device.LastUserId = userId;
            device.LastSeenAt = now;
        }
    }
}
