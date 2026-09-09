namespace Susumu.Domain.Entities;

public sealed class AppUser
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid LocationId { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>Stored lowercase; unique per company.</summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>PBKDF2 hash produced by ASP.NET Core's PasswordHasher. Never a plaintext password.</summary>
    public string PasswordHash { get; set; } = string.Empty;

    public UserRole Role { get; set; }
    public bool Active { get; set; } = true;

    /// <summary>
    /// Rotated whenever the account is deactivated, its role changes or its password is reset.
    /// Access tokens carry the stamp so revocation is enforced on every authenticated request.
    /// </summary>
    public string SecurityStamp { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Company? Company { get; set; }
    public Location? Location { get; set; }
}
