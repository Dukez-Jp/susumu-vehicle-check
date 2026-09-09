using Susumu.Api.Tests.Infrastructure;
using Susumu.Infrastructure.Persistence;

namespace Susumu.Api.Tests;

/// <summary>Integration ledger: design-time tooling must never guess which database it may alter.</summary>
[Collection(EnvironmentSensitiveCollection.Name)]
public sealed class DesignTimeFactoryTests
{
    [Fact]
    public void The_design_time_factory_refuses_to_run_without_an_explicit_connection()
    {
        var original = Environment.GetEnvironmentVariable(SusumuDbContextFactory.ConnectionVariable);

        try
        {
            Environment.SetEnvironmentVariable(SusumuDbContextFactory.ConnectionVariable, null);

            var error = Assert.Throws<InvalidOperationException>(
                () => new SusumuDbContextFactory().CreateDbContext([]));

            Assert.Contains(SusumuDbContextFactory.ConnectionVariable, error.Message);
            Assert.DoesNotContain("Password", error.Message, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            Environment.SetEnvironmentVariable(SusumuDbContextFactory.ConnectionVariable, original);
        }
    }
}

/// <summary>
/// Regressions for the destructive-test gate (integration ledger #27). These run everywhere and
/// never touch a database: the guard is a pure decision made before any connection is opened.
/// </summary>
[Collection(EnvironmentSensitiveCollection.Name)]
public sealed class TestDatabaseGuardTests
{
    private const string Loopback = "Host=127.0.0.1;Port=55432;Database=susumu_test;Username=u;Password=p";

    [Fact]
    public void An_approved_loopback_throwaway_target_with_the_opt_in_is_allowed()
    {
        var verdict = PostgresTestDatabase.Inspect(Loopback, destructiveAllowed: true);

        Assert.True(verdict.Allowed);
    }

    [Fact]
    public void Without_the_explicit_opt_in_nothing_is_allowed()
    {
        var verdict = PostgresTestDatabase.Inspect(Loopback, destructiveAllowed: false);

        Assert.False(verdict.Allowed);
        Assert.Contains(PostgresTestDatabase.OptInVariable, verdict.Reason);
    }

    [Fact]
    public void A_missing_connection_string_is_refused()
    {
        Assert.False(PostgresTestDatabase.Inspect(null, true).Allowed);
        Assert.False(PostgresTestDatabase.Inspect("   ", true).Allowed);
    }

    [Theory]
    [InlineData("Host=db.internal;Port=5432;Database=susumu_test;Username=u;Password=p")]
    [InlineData("Host=10.0.0.4;Port=5432;Database=susumu_test;Username=u;Password=p")]
    [InlineData("Host=example.jp;Port=5432;Database=susumu_ci;Username=u;Password=p")]
    public void A_non_loopback_host_is_refused(string connectionString)
    {
        var verdict = PostgresTestDatabase.Inspect(connectionString, destructiveAllowed: true);

        Assert.False(verdict.Allowed);
        Assert.Contains("loopback", verdict.Reason);
    }

    [Theory]
    [InlineData("susumu_dev")]
    [InlineData("susumu")]
    [InlineData("postgres")]
    [InlineData("susumu_testing")]
    [InlineData("susumu_test_2")]
    [InlineData("prod_susumu_test")]
    [InlineData("susumu_cidev")]
    [InlineData("susumu_ci_")]
    [InlineData("susumu_ci__x")]
    [InlineData("susumu_ci_tests;DROP")]
    public void A_database_name_that_is_not_a_deliberate_throwaway_is_refused(string database)
    {
        var connectionString = $"Host=127.0.0.1;Port=55432;Database={database};Username=u;Password=p";

        var verdict = PostgresTestDatabase.Inspect(connectionString, destructiveAllowed: true);

        Assert.False(verdict.Allowed);
    }

    [Theory]
    [InlineData("susumu_test")]
    [InlineData("susumu_ci")]
    [InlineData("susumu_ci_tests")]
    [InlineData("susumu_ci_pr_1234")]
    public void The_deliberate_throwaway_names_are_accepted(string database)
    {
        Assert.True(PostgresTestDatabase.IsApprovedName(database));

        var connectionString = $"Host=localhost;Port=55432;Database={database};Username=u;Password=p";
        Assert.True(PostgresTestDatabase.Inspect(connectionString, destructiveAllowed: true).Allowed);
    }

    [Fact]
    public void The_refusal_reason_never_echoes_the_connection_string()
    {
        const string secret = "Host=db.internal;Port=5432;Database=susumu_dev;Username=admin;Password=Sup3rSecret";

        var verdict = PostgresTestDatabase.Inspect(secret, destructiveAllowed: true);

        Assert.False(verdict.Allowed);
        Assert.DoesNotContain("Sup3rSecret", verdict.Reason, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("db.internal", verdict.Reason, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("admin", verdict.Reason, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// CI coordination: the unit-test host must keep its own SQLite database even when the process
    /// environment carries a PostgreSQL connection for the demo API or for the integration job.
    /// </summary>
    [Fact]
    public async Task A_process_wide_database_connection_cannot_hijack_the_unit_test_host()
    {
        var original = Environment.GetEnvironmentVariable("SUSUMU_DB_CONNECTION");
        var originalProvider = Environment.GetEnvironmentVariable("SUSUMU_DB_PROVIDER");

        try
        {
            Environment.SetEnvironmentVariable(
                "SUSUMU_DB_CONNECTION", "Host=127.0.0.1;Port=1;Database=susumu_dev;Username=nobody;Password=nope");
            Environment.SetEnvironmentVariable("SUSUMU_DB_PROVIDER", "postgres");

            var app = new TestApp();
            await app.InitializeAsync();
            try
            {
                // Reaching the database at all proves the sqlite setting survived; the environment
                // points at a port nothing listens on.
                var provider = await app.WithDbAsync(db => Task.FromResult(db.Database.ProviderName));
                Assert.Contains("Sqlite", provider, StringComparison.OrdinalIgnoreCase);
            }
            finally
            {
                await app.DisposeAsync();
            }
        }
        finally
        {
            Environment.SetEnvironmentVariable("SUSUMU_DB_CONNECTION", original);
            Environment.SetEnvironmentVariable("SUSUMU_DB_PROVIDER", originalProvider);
        }
    }

    [Fact]
    public void Requiring_an_approved_target_throws_rather_than_returning_an_unsafe_one()
    {
        var error = Assert.Throws<InvalidOperationException>(() => PostgresTestDatabase.Require(
            "Host=127.0.0.1;Port=55432;Database=susumu_dev;Username=u;Password=p", destructiveAllowed: true));

        Assert.Contains("throwaway", error.Message);
        Assert.DoesNotContain("Password", error.Message, StringComparison.OrdinalIgnoreCase);

        Assert.Equal(Loopback, PostgresTestDatabase.Require(Loopback, destructiveAllowed: true));
    }
}
