namespace Susumu.Infrastructure.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>Minimum 32 bytes. Supplied by SUSUMU_JWT_SIGNING_KEY; never has a production default.</summary>
    public string SigningKey { get; set; } = string.Empty;

    public string Issuer { get; set; } = "susumu-vehicle-check";
    public string Audience { get; set; } = "susumu-vehicle-check-clients";

    /// <summary>Online session length. Syncing after expiry requires a fresh login.</summary>
    public TimeSpan AccessTokenLifetime { get; set; } = TimeSpan.FromHours(12);

    /// <summary>
    /// How long a device may keep producing offline drafts after an online authentication.
    /// Contract value: 72 hours. Drafts are never discarded when it lapses; they just need a new login to sync.
    /// </summary>
    public TimeSpan OfflineWindow { get; set; } = TimeSpan.FromHours(72);

    public const int MinimumSigningKeyBytes = 32;

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(SigningKey))
        {
            throw new InvalidOperationException(
                "JWT signing key missing. Set SUSUMU_JWT_SIGNING_KEY to at least 32 bytes of random data.");
        }

        if (System.Text.Encoding.UTF8.GetByteCount(SigningKey) < MinimumSigningKeyBytes)
        {
            throw new InvalidOperationException(
                $"JWT signing key must be at least {MinimumSigningKeyBytes} bytes (got " +
                $"{System.Text.Encoding.UTF8.GetByteCount(SigningKey)}).");
        }

        if (AccessTokenLifetime <= TimeSpan.Zero)
        {
            throw new InvalidOperationException("Jwt:AccessTokenLifetime must be positive.");
        }

        if (OfflineWindow <= TimeSpan.Zero)
        {
            throw new InvalidOperationException("Jwt:OfflineWindow must be positive.");
        }
    }
}
