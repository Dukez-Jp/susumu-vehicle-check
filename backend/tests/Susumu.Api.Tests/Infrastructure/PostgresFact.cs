using Npgsql;

namespace Susumu.Api.Tests.Infrastructure;

/// <summary>
/// A test that needs a real PostgreSQL instance. Without an approved target the test is skipped with
/// an explicit reason and appears as skipped, never as passed.
/// </summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        var verdict = PostgresTestDatabase.Inspect(
            PostgresTestDatabase.ConnectionString, PostgresTestDatabase.DestructiveAllowed);

        if (!verdict.Allowed)
        {
            Skip = $"PostgreSQL integration coverage did not run: {verdict.Reason}";
        }
    }
}

public sealed record TestDatabaseVerdict(bool Allowed, string Reason);

/// <summary>
/// Safety gate for the destructive PostgreSQL tests. They drop and recreate their target, so the
/// target must be an explicitly authorised, deliberately named, loopback-only throwaway database.
///
/// Three independent conditions must all hold. Any other target is refused before a connection is
/// even opened, so a mistyped or inherited environment variable can never reach a real database.
/// The connection string itself is never returned in a reason, logged or asserted on.
/// </summary>
public static class PostgresTestDatabase
{
    public const string ConnectionVariable = "TEST_DATABASE_URL";
    public const string OptInVariable = "SUSUMU_ALLOW_DESTRUCTIVE_TEST_DB";

    private static readonly string[] LoopbackHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];

    public static string? ConnectionString => Environment.GetEnvironmentVariable(ConnectionVariable);

    public static bool DestructiveAllowed =>
        string.Equals(Environment.GetEnvironmentVariable(OptInVariable), "true", StringComparison.OrdinalIgnoreCase);

    /// <summary>Throws unless the target passes every gate. Call before any connection is opened.</summary>
    public static string RequireApprovedTarget()
        => Require(ConnectionString, DestructiveAllowed);

    /// <summary>
    /// Pure form, so the guard can be exercised without touching process-wide environment variables
    /// that other tests running in parallel would observe.
    /// </summary>
    public static string Require(string? connectionString, bool destructiveAllowed)
    {
        var verdict = Inspect(connectionString, destructiveAllowed);

        if (!verdict.Allowed)
        {
            throw new InvalidOperationException($"Refusing to run destructive database tests: {verdict.Reason}");
        }

        return connectionString!;
    }

    public static TestDatabaseVerdict Inspect(string? connectionString, bool destructiveAllowed)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return new TestDatabaseVerdict(false, $"{ConnectionVariable} is not set.");
        }

        if (!destructiveAllowed)
        {
            return new TestDatabaseVerdict(
                false, $"{OptInVariable} is not 'true'; destructive tests require an explicit opt-in.");
        }

        NpgsqlConnectionStringBuilder builder;
        try
        {
            builder = new NpgsqlConnectionStringBuilder(connectionString);
        }
        catch (Exception ex) when (ex is ArgumentException or FormatException)
        {
            return new TestDatabaseVerdict(false, $"{ConnectionVariable} is not a valid Npgsql connection string.");
        }

        var host = builder.Host?.Trim() ?? string.Empty;
        if (!LoopbackHosts.Contains(host, StringComparer.OrdinalIgnoreCase))
        {
            // The host is named, never echoed, so a reason can be logged safely.
            return new TestDatabaseVerdict(
                false, "the target host is not loopback; destructive tests only run against 127.0.0.1/localhost/::1.");
        }

        var database = builder.Database?.Trim() ?? string.Empty;
        if (!IsApprovedName(database))
        {
            return new TestDatabaseVerdict(
                false, "the target database name is not an approved throwaway name (susumu_test or susumu_ci[_suffix]).");
        }

        return new TestDatabaseVerdict(true, "approved throwaway target.");
    }

    /// <summary>
    /// Exactly <c>susumu_test</c>, or <c>susumu_ci</c> optionally followed by underscore-separated
    /// alphanumeric suffixes. Deliberately strict: <c>susumu_dev</c>, <c>susumu_testing</c> and
    /// anything else are refused.
    /// </summary>
    public static bool IsApprovedName(string database)
    {
        if (string.Equals(database, "susumu_test", StringComparison.Ordinal))
        {
            return true;
        }

        if (!database.StartsWith("susumu_ci", StringComparison.Ordinal))
        {
            return false;
        }

        var suffix = database["susumu_ci".Length..];
        if (suffix.Length == 0)
        {
            return true;
        }

        if (suffix[0] != '_')
        {
            return false;
        }

        return suffix[1..].Split('_', StringSplitOptions.None)
            .All(part => part.Length > 0 && part.All(char.IsAsciiLetterOrDigit));
    }
}
