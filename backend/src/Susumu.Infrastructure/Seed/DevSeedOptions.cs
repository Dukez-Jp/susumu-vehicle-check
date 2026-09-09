namespace Susumu.Infrastructure.Seed;

public sealed class DevSeedOptions
{
    public const string SectionName = "DevSeed";

    /// <summary>Only ever enabled for the Development environment; guarded again inside the seeder.</summary>
    public bool Enabled { get; set; }

    public string AdminUsername { get; set; } = "admin";

    /// <summary>From SUSUMU_BOOTSTRAP_ADMIN_PASSWORD. Generated and written to a local file when absent.</summary>
    public string? AdminPassword { get; set; }

    public string? SupervisorPassword { get; set; }

    public string? InspectorPassword { get; set; }

    public string? OfficePassword { get; set; }

    /// <summary>Gitignored file receiving generated DEV passwords so the local team can sign in.</summary>
    public string CredentialsFilePath { get; set; } = string.Empty;
}
