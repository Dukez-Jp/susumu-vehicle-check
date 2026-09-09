namespace Susumu.Api.Configuration;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public const string Postgres = "postgres";
    public const string Sqlite = "sqlite";

    /// <summary>PostgreSQL is the production provider; sqlite exists only for fast local test runs.</summary>
    public string Provider { get; set; } = Postgres;

    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>Applying migrations on boot is convenient in DEV and deliberately opt-in elsewhere.</summary>
    public bool ApplyMigrationsAtStartup { get; set; }

    public bool IsSqlite => string.Equals(Provider, Sqlite, StringComparison.OrdinalIgnoreCase);
}
