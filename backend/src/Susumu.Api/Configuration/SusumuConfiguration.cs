using System.Security.Cryptography;

namespace Susumu.Api.Configuration;

/// <summary>
/// Maps the documented SUSUMU_* environment variables onto configuration keys and supplies the
/// local-only fallbacks. Outside Development every secret must be provided explicitly.
/// </summary>
public static class SusumuConfiguration
{
    /// <summary>
    /// Set by a host that has already decided its own database and secrets — the automated test
    /// factories. It makes the process environment inert for this host, so a
    /// <c>SUSUMU_DB_CONNECTION</c> exported for the demo API or for CI can never silently redirect a
    /// unit-test host at a real database.
    /// </summary>
    public const string IgnoreEnvironmentKey = "Susumu:IgnoreEnvironmentOverrides";

    public static void AddSusumuConfiguration(this WebApplicationBuilder builder)
    {
        if (string.Equals(builder.Configuration[IgnoreEnvironmentKey], "true", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var map = new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = Environment.GetEnvironmentVariable("SUSUMU_JWT_SIGNING_KEY"),
            ["Database:ConnectionString"] = Environment.GetEnvironmentVariable("SUSUMU_DB_CONNECTION"),
            ["Database:Provider"] = Environment.GetEnvironmentVariable("SUSUMU_DB_PROVIDER"),
            ["PhotoStorage:RootPath"] = Environment.GetEnvironmentVariable("SUSUMU_PHOTO_ROOT"),
            ["Network:TrustedProxies"] = Environment.GetEnvironmentVariable("SUSUMU_TRUSTED_PROXIES"),
            ["DevSeed:Enabled"] = Environment.GetEnvironmentVariable("SUSUMU_DEV_SEED"),
            ["DevSeed:AdminUsername"] = Environment.GetEnvironmentVariable("SUSUMU_BOOTSTRAP_ADMIN_USERNAME"),
            ["DevSeed:AdminPassword"] = Environment.GetEnvironmentVariable("SUSUMU_BOOTSTRAP_ADMIN_PASSWORD"),
            ["DevSeed:SupervisorPassword"] = Environment.GetEnvironmentVariable("SUSUMU_DEV_SUPERVISOR_PASSWORD"),
            ["DevSeed:InspectorPassword"] = Environment.GetEnvironmentVariable("SUSUMU_DEV_INSPECTOR_PASSWORD"),
            ["DevSeed:OfficePassword"] = Environment.GetEnvironmentVariable("SUSUMU_DEV_OFFICE_PASSWORD"),
        };

        var present = map
            .Where(pair => !string.IsNullOrWhiteSpace(pair.Value))
            .ToDictionary(pair => pair.Key, pair => pair.Value);

        if (present.Count > 0)
        {
            builder.Configuration.AddInMemoryCollection(present);
        }

        ApplyDevelopmentDefaults(builder);
    }

    /// <summary>
    /// Development conveniences only, and only for values that are not credentials for anything
    /// outside this machine. There is deliberately no default database connection: the API must be
    /// told which database it is talking to.
    /// </summary>
    private static void ApplyDevelopmentDefaults(WebApplicationBuilder builder)
    {
        if (!builder.Environment.IsDevelopment())
        {
            return;
        }

        var localDirectory = Path.Combine(builder.Environment.ContentRootPath, ".local");
        var defaults = new Dictionary<string, string?>();

        if (string.IsNullOrWhiteSpace(builder.Configuration["Jwt:SigningKey"]))
        {
            // Generated once and reused, so restarting the API does not invalidate tokens mid-test.
            defaults["Jwt:SigningKey"] = ReadOrCreateDevSigningKey(Path.Combine(localDirectory, "dev-jwt-key.txt"));
        }

        if (string.IsNullOrWhiteSpace(builder.Configuration["PhotoStorage:RootPath"]))
        {
            defaults["PhotoStorage:RootPath"] = Path.Combine(localDirectory, "photo-storage");
        }

        if (string.IsNullOrWhiteSpace(builder.Configuration["DevSeed:CredentialsFilePath"]))
        {
            defaults["DevSeed:CredentialsFilePath"] = Path.Combine(localDirectory, "dev-credentials.json");
        }

        if (defaults.Count > 0)
        {
            builder.Configuration.AddInMemoryCollection(defaults);
        }
    }

    private static string ReadOrCreateDevSigningKey(string path)
    {
        if (File.Exists(path))
        {
            var existing = File.ReadAllText(path).Trim();
            if (existing.Length >= 32)
            {
                return existing;
            }
        }

        var generated = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, generated);
        return generated;
    }
}
