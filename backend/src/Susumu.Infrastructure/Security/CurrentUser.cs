using Susumu.Domain;

namespace Susumu.Infrastructure.Security;

/// <summary>
/// The authenticated actor, always rebuilt from the database on each request. Company/location and
/// role come from the stored account, never from client-supplied fields.
/// </summary>
public sealed record CurrentUser(
    Guid Id,
    Guid CompanyId,
    Guid LocationId,
    UserRole Role,
    string Name,
    string Username)
{
    /// <summary>Administrators see the whole company; every other role is limited to its location.</summary>
    public bool IsCompanyWide => Role == UserRole.Administrator;

    public bool IsAdministrator => Role == UserRole.Administrator;

    public bool CanReview => Role is UserRole.Administrator or UserRole.Supervisor;

    public bool CanRecordInspections => Role is UserRole.Administrator or UserRole.Supervisor or UserRole.Inspector;
}

public static class SusumuClaims
{
    public const string UserId = "sub";
    public const string Username = "username";
    public const string Name = "name";
    public const string Role = "role";
    public const string CompanyId = "company_id";
    public const string LocationId = "location_id";
    public const string DeviceId = "device_id";

    /// <summary>Mirrors <see cref="Domain.Entities.AppUser.SecurityStamp"/> so revocation takes effect immediately.</summary>
    public const string SecurityStamp = "stamp";
}
