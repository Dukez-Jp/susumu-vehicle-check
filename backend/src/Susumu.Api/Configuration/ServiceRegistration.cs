using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Susumu.Api.Security;
using Susumu.Infrastructure;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Seed;
using Susumu.Infrastructure.Services;
using Susumu.Infrastructure.Storage;
using Susumu.Infrastructure.Time;

namespace Susumu.Api.Configuration;

public static class ServiceRegistration
{
    public static void AddSusumuServices(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        jwt.Validate();
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        var database = configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>() ?? new DatabaseOptions();
        if (string.IsNullOrWhiteSpace(database.ConnectionString))
        {
            throw new InvalidOperationException(
                "Database connection string missing. Set SUSUMU_DB_CONNECTION or Database:ConnectionString.");
        }

        if (database.IsSqlite && !builder.Environment.IsDevelopment() && !IsTestHost(builder.Environment))
        {
            throw new InvalidOperationException(
                "The SQLite provider is only allowed in Development and test runs. Production uses PostgreSQL.");
        }

        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.SectionName));
        services.Configure<PhotoStorageOptions>(configuration.GetSection(PhotoStorageOptions.SectionName));
        services.Configure<DevSeedOptions>(configuration.GetSection(DevSeedOptions.SectionName));

        var throttle = configuration.GetSection(LoginThrottleOptions.SectionName).Get<LoginThrottleOptions>()
                       ?? new LoginThrottleOptions();
        throttle.Validate();
        services.Configure<LoginThrottleOptions>(configuration.GetSection(LoginThrottleOptions.SectionName));

        var network = configuration.GetSection(NetworkOptions.SectionName).Get<NetworkOptions>() ?? new NetworkOptions();
        services.Configure<NetworkOptions>(configuration.GetSection(NetworkOptions.SectionName));
        services.AddSusumuForwardedHeaders(network);

        services.AddDbContext<SusumuDbContext>(options =>
        {
            if (database.IsSqlite)
            {
                options.UseSqlite(database.ConnectionString);
            }
            else
            {
                options.UseNpgsql(
                    database.ConnectionString,
                    npgsql => npgsql.MigrationsAssembly(typeof(SusumuDbContext).Assembly.FullName));
            }
        });

        services.AddMemoryCache();
        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IPasswordHashing, PasswordHashing>();
        services.AddSingleton<ITokenService, TokenService>();
        services.AddSingleton<ILoginThrottle, LoginThrottle>();
        services.AddSingleton<IPhotoStorage, FileSystemPhotoStorage>();

        services.AddScoped<AuthService>();
        services.AddScoped<VehicleService>();
        services.AddScoped<VehicleTypeService>();
        services.AddScoped<TemplateService>();
        services.AddScoped<InspectionQueryService>();
        services.AddScoped<InspectionSyncService>();
        services.AddScoped<PhotoService>();
        services.AddScoped<UserAdminService>();
        services.AddScoped<OrganizationAdministrationService>();
        services.AddScoped<ReportingService>();
        services.AddScoped<DevSeeder>();
        services.AddScoped<InitialProvisioning>();

        services.AddSusumuAuthentication(jwt);

        services.AddProblemDetails();
        services.AddExceptionHandler<AppExceptionHandler>();

        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            options.SerializerOptions.PropertyNameCaseInsensitive = true;
            SusumuJson.Configure(options.SerializerOptions);
        });

        var maxPhotoBytes = configuration.GetSection(PhotoStorageOptions.SectionName).Get<PhotoStorageOptions>()?.MaxBytes
                            ?? new PhotoStorageOptions().MaxBytes;

        services.Configure<FormOptions>(options =>
        {
            // Slack above the attachment limit so oversized uploads fail with a clean 413 from the
            // service instead of an opaque parser error.
            options.MultipartBodyLengthLimit = maxPhotoBytes + (1L * 1024 * 1024);
            options.ValueLengthLimit = 1024 * 1024;
        });

        services.AddOpenApi();

        // Runs as a hosted service so the schema is ready before the first request, both when the
        // API is started normally and when a test host boots the same Program.
        services.AddHostedService<DatabaseStartupService>();
    }

    /// <summary>The automated test host runs under its own environment name and may use SQLite.</summary>
    private static bool IsTestHost(IWebHostEnvironment environment)
        => environment.IsEnvironment("Testing");
}
