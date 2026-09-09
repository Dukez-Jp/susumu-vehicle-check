using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Seed;

namespace Susumu.Api.Configuration;

/// <summary>
/// <c>dotnet run --project src/Susumu.Api -- provision</c>.
///
/// One-shot command for a fresh installation: applies migrations and creates the first company,
/// location and administrator from operator-supplied environment variables, then exits without ever
/// starting an HTTP listener. It never enables the Development fixture and never prints the password.
/// </summary>
public static class ProvisioningCommand
{
    public const string Verb = "provision";

    public static bool IsRequested(string[] args)
        => args.Any(arg => string.Equals(arg, Verb, StringComparison.OrdinalIgnoreCase));

    public static async Task<int> RunAsync(WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var provider = scope.ServiceProvider;
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("Susumu.Provisioning");
        var database = provider.GetRequiredService<IOptions<DatabaseOptions>>().Value;

        try
        {
            if (database.IsSqlite)
            {
                throw new InvalidOperationException(
                    "Initial provisioning targets a PostgreSQL installation; set Database:Provider=postgres.");
            }

            var db = provider.GetRequiredService<SusumuDbContext>();
            logger.LogInformation("Applying migrations before provisioning.");
            await db.Database.MigrateAsync();

            var request = new ProvisioningRequest(
                Environment.GetEnvironmentVariable("SUSUMU_PROVISION_COMPANY"),
                Environment.GetEnvironmentVariable("SUSUMU_PROVISION_LOCATION"),
                Environment.GetEnvironmentVariable("SUSUMU_PROVISION_ADMIN_NAME"),
                Environment.GetEnvironmentVariable("SUSUMU_PROVISION_ADMIN_USERNAME"),
                Environment.GetEnvironmentVariable("SUSUMU_PROVISION_ADMIN_PASSWORD"));

            var result = await provider.GetRequiredService<InitialProvisioning>().RunAsync(request, default);

            // Identifiers only. The password came from the environment and stays there.
            logger.LogInformation(
                "Provisioned company {CompanyId}, location {LocationId} and administrator '{Username}' ({UserId}).",
                result.CompanyId, result.LocationId, result.AdminUsername, result.AdminUserId);

            return 0;
        }
        catch (Exception ex)
        {
            logger.LogError("Provisioning failed: {Message}", ex.Message);
            return 1;
        }
    }
}
