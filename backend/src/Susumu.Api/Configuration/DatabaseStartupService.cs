using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Seed;

namespace Susumu.Api.Configuration;

/// <summary>
/// Prepares the schema, and in Development only the synthetic fixture, before the API accepts
/// traffic. Migrations are the single mechanism for PostgreSQL schema changes; EnsureCreated is used
/// exclusively by the SQLite Development/test provider, which carries no migration history.
/// </summary>
public sealed class DatabaseStartupService(
    IServiceProvider services,
    IHostEnvironment environment,
    IOptions<DatabaseOptions> databaseOptions,
    ILogger<DatabaseStartupService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;
        var options = databaseOptions.Value;
        var db = provider.GetRequiredService<SusumuDbContext>();

        if (options.IsSqlite)
        {
            await db.Database.EnsureCreatedAsync(ct);
        }
        else if (options.ApplyMigrationsAtStartup)
        {
            logger.LogInformation("Applying pending EF Core migrations.");
            await db.Database.MigrateAsync(ct);
        }

        var seeder = provider.GetRequiredService<DevSeeder>();
        var report = await seeder.RunAsync(environment.IsDevelopment(), ct);

        if (report.Executed && report.GeneratedPasswords.Count > 0)
        {
            logger.LogWarning(
                "DEV accounts were created with generated passwords. See DevSeed:CredentialsFilePath for the values.");
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
