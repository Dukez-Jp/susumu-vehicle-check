using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;

namespace Susumu.Api.Tests.Infrastructure;

/// <summary>
/// Boots the real Program with a private SQLite file and a private attachment directory, so every
/// test exercises the actual pipeline (authentication, authorization, EF persistence, storage)
/// against isolated state.
/// </summary>
public sealed class TestApp : IAsyncLifetime
{
    public const string Password = "test-password-123";
    public const string SigningKey = "susumu-test-signing-key-that-is-long-enough-0123456789";

    private readonly string _root = Path.Combine(Path.GetTempPath(), "susumu-tests", Guid.NewGuid().ToString("N"));
    private ApiFactory _factory = null!;

    public HttpClient Anonymous { get; private set; } = null!;

    public TestFixture Fixture { get; private set; } = null!;

    public string PhotoRoot => Path.Combine(_root, "photos");

    /// <summary>Stored attachment objects. Empty, rather than throwing, before anything is written.</summary>
    public IReadOnlyList<string> StoredPhotoFiles()
        => Directory.Exists(PhotoRoot)
            ? Directory.GetFiles(PhotoRoot, "*.*", SearchOption.AllDirectories)
            : [];

    public Task InitializeAsync()
    {
        Directory.CreateDirectory(_root);
        _factory = new ApiFactory(Path.Combine(_root, "susumu-test.db"), PhotoRoot);
        Anonymous = _factory.CreateClient();
        return SeedAsync();
    }

    public async Task DisposeAsync()
    {
        Anonymous.Dispose();
        await _factory.DisposeAsync();

        try
        {
            Directory.Delete(_root, recursive: true);
        }
        catch (IOException)
        {
            // A locked SQLite file must never fail a test run.
        }
    }

    public IServiceScope CreateScope() => _factory.Services.CreateScope();

    public async Task<T> WithDbAsync<T>(Func<SusumuDbContext, Task<T>> action)
    {
        using var scope = CreateScope();
        return await action(scope.ServiceProvider.GetRequiredService<SusumuDbContext>());
    }

    public async Task WithDbAsync(Func<SusumuDbContext, Task> action)
    {
        using var scope = CreateScope();
        await action(scope.ServiceProvider.GetRequiredService<SusumuDbContext>());
    }

    public async Task<HttpClient> SignInAsync(string username, string deviceId = "tablet-test-01", string? password = null)
    {
        var response = await Anonymous.PostAsJsonAsync(
            "/api/v1/auth/login",
            new LoginRequest(username, password ?? Password, deviceId),
            SusumuJson.Options);

        response.EnsureSuccessStatusCode();
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>(SusumuJson.Options);

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login!.AccessToken);
        return client;
    }

    private async Task SeedAsync()
    {
        using var scope = CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SusumuDbContext>();
        var hashing = scope.ServiceProvider.GetRequiredService<IPasswordHashing>();
        var now = DateTimeOffset.UtcNow;
        var fixture = new TestFixture();
        var hash = hashing.Hash(Password);

        db.Companies.Add(new Company { Id = fixture.CompanyId, Name = "Test Company", CreatedAt = now });
        db.Companies.Add(new Company { Id = fixture.OtherCompanyId, Name = "Other Company", CreatedAt = now });
        foreach (var code in new[] { "Caminhão", "Van", "Truck" })
        {
            db.Set<VehicleType>().Add(new VehicleType
            {
                Id = Guid.NewGuid(), CompanyId = fixture.CompanyId, Code = code, NormalizedCode = code.ToUpperInvariant(),
                Name = code, Active = true, CreatedAt = now, UpdatedAt = now, Version = 1,
            });
        }

        db.Locations.Add(new Location
        {
            Id = fixture.LocationId, CompanyId = fixture.CompanyId, Name = "Workshop A", CreatedAt = now,
        });
        db.Locations.Add(new Location
        {
            Id = fixture.SecondLocationId, CompanyId = fixture.CompanyId, Name = "Workshop B", CreatedAt = now,
        });
        db.Locations.Add(new Location
        {
            Id = fixture.OtherCompanyLocationId, CompanyId = fixture.OtherCompanyId, Name = "Rival", CreatedAt = now,
        });

        AddUser(fixture.AdminId, "admin", "Admin", UserRole.Administrator, fixture.LocationId, fixture.CompanyId);
        AddUser(fixture.SupervisorId, "supervisor", "Supervisor", UserRole.Supervisor, fixture.LocationId, fixture.CompanyId);
        AddUser(fixture.InspectorId, "inspector", "Inspector", UserRole.Inspector, fixture.LocationId, fixture.CompanyId);
        AddUser(fixture.SecondInspectorId, "inspector2", "Inspector Two", UserRole.Inspector, fixture.LocationId, fixture.CompanyId);
        AddUser(fixture.OfficeId, "office", "Office", UserRole.Office, fixture.LocationId, fixture.CompanyId);
        AddUser(fixture.OtherLocationInspectorId, "inspector-b", "Inspector B", UserRole.Inspector, fixture.SecondLocationId, fixture.CompanyId);
        AddUser(fixture.InactiveId, "inactive", "Inactive", UserRole.Inspector, fixture.LocationId, fixture.CompanyId, active: false);

        db.Vehicles.Add(new Vehicle
        {
            Id = fixture.TruckId,
            CompanyId = fixture.CompanyId,
            LocationId = fixture.LocationId,
            InternalNumber = "714",
            Plate = "TEST-714",
            Type = "Caminhão",
            CurrentOdometerKm = 100_000,
            Active = true,
            CreatedAt = now,
            UpdatedAt = now,
        });

        db.Vehicles.Add(new Vehicle
        {
            Id = fixture.OtherLocationVehicleId,
            CompanyId = fixture.CompanyId,
            LocationId = fixture.SecondLocationId,
            InternalNumber = "820",
            Plate = "TEST-820",
            Type = "Caminhão",
            CurrentOdometerKm = 5_000,
            Active = true,
            CreatedAt = now,
            UpdatedAt = now,
        });

        var template = new ChecklistTemplate
        {
            Id = fixture.TemplateId,
            CompanyId = fixture.CompanyId,
            Name = "Check-in diário de caminhão",
            VehicleType = "Caminhão",
            Version = 1,
            Published = true,
            PublishedAt = now,
            CreatedAt = now,
            CreatedByUserId = fixture.AdminId,
        };

        var section = new ChecklistSection
        {
            Id = fixture.SectionId, TemplateId = template.Id, Title = "Pneus e freios", OrderIndex = 0,
        };

        section.Items.Add(new ChecklistItem
        {
            Id = fixture.RequiredStatusItemId,
            SectionId = section.Id,
            Label = "Freio de estacionamento",
            ResponseType = ResponseType.Status,
            Required = true,
            OrderIndex = 0,
        });

        section.Items.Add(new ChecklistItem
        {
            Id = fixture.RequiredMeasurementItemId,
            SectionId = section.Id,
            Label = "Pressão do pneu dianteiro esquerdo",
            ResponseType = ResponseType.Measurement,
            Required = true,
            Unit = "kPa",
            MinValue = 400m,
            MaxValue = 900m,
            OrderIndex = 1,
        });

        section.Items.Add(new ChecklistItem
        {
            Id = fixture.OptionalStatusItemId,
            SectionId = section.Id,
            Label = "Buzina",
            ResponseType = ResponseType.Status,
            Required = false,
            OrderIndex = 2,
        });

        template.Sections.Add(section);
        db.ChecklistTemplates.Add(template);

        await db.SaveChangesAsync();
        Fixture = fixture;

        void AddUser(Guid id, string username, string name, UserRole role, Guid locationId, Guid companyId, bool active = true)
            => db.Users.Add(new AppUser
            {
                Id = id,
                CompanyId = companyId,
                LocationId = locationId,
                Name = name,
                Username = username,
                PasswordHash = hash,
                Role = role,
                Active = active,
                SecurityStamp = Guid.NewGuid().ToString("N"),
                CreatedAt = now,
                UpdatedAt = now,
            });
    }

    private sealed class ApiFactory(string databasePath, string photoRoot) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");

            // Makes the process environment inert for this host. Without it a SUSUMU_DB_CONNECTION
            // exported for the demo API or for CI would override the settings below and point these
            // tests at a real database.
            builder.UseSetting("Susumu:IgnoreEnvironmentOverrides", "true");
            builder.UseSetting("Database:Provider", "sqlite");
            builder.UseSetting("Database:ConnectionString", $"Data Source={databasePath}");
            builder.UseSetting("Database:ApplyMigrationsAtStartup", "false");
            builder.UseSetting("Jwt:SigningKey", SigningKey);
            builder.UseSetting("PhotoStorage:RootPath", photoRoot);
            builder.UseSetting("DevSeed:Enabled", "false");
        }
    }
}

/// <summary>Stable identifiers for the records created by <see cref="TestApp"/>.</summary>
public sealed class TestFixture
{
    public Guid CompanyId { get; } = Guid.NewGuid();
    public Guid OtherCompanyId { get; } = Guid.NewGuid();
    public Guid LocationId { get; } = Guid.NewGuid();
    public Guid SecondLocationId { get; } = Guid.NewGuid();
    public Guid OtherCompanyLocationId { get; } = Guid.NewGuid();

    public Guid AdminId { get; } = Guid.NewGuid();
    public Guid SupervisorId { get; } = Guid.NewGuid();
    public Guid InspectorId { get; } = Guid.NewGuid();
    public Guid SecondInspectorId { get; } = Guid.NewGuid();
    public Guid OfficeId { get; } = Guid.NewGuid();
    public Guid OtherLocationInspectorId { get; } = Guid.NewGuid();
    public Guid InactiveId { get; } = Guid.NewGuid();

    public Guid TruckId { get; } = Guid.NewGuid();
    public Guid OtherLocationVehicleId { get; } = Guid.NewGuid();

    public Guid TemplateId { get; } = Guid.NewGuid();
    public Guid SectionId { get; } = Guid.NewGuid();
    public Guid RequiredStatusItemId { get; } = Guid.NewGuid();
    public Guid RequiredMeasurementItemId { get; } = Guid.NewGuid();
    public Guid OptionalStatusItemId { get; } = Guid.NewGuid();
}
