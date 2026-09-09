using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Susumu.Domain;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Seed;
using Susumu.Infrastructure.Time;

namespace Susumu.Api.Tests;

public sealed class DevSeedTests : IAsyncLifetime
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "susumu-seed", Guid.NewGuid().ToString("N"));
    private SusumuDbContext _db = null!;

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_directory);
        var options = new DbContextOptionsBuilder<SusumuDbContext>()
            .UseSqlite($"Data Source={Path.Combine(_directory, "seed.db")}")
            .Options;

        _db = new SusumuDbContext(options);
        await _db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        try
        {
            Directory.Delete(_directory, recursive: true);
        }
        catch (IOException)
        {
            // Locked SQLite files must not fail the run.
        }
    }

    private DevSeeder Seeder(DevSeedOptions? options = null) => new(
        _db,
        new PasswordHashing(),
        new SystemClock(),
        Options.Create(options ?? new DevSeedOptions
        {
            Enabled = true,
            AdminUsername = "admin",
            AdminPassword = "dev-admin-password",
            SupervisorPassword = "dev-supervisor-password",
            InspectorPassword = "dev-inspector-password",
            OfficePassword = "dev-office-password",
            CredentialsFilePath = Path.Combine(_directory, "credentials.json"),
        }),
        NullLogger<DevSeeder>.Instance);

    [Fact]
    public async Task The_seed_creates_the_synthetic_truck_714_and_a_published_checklist()
    {
        var report = await Seeder().RunAsync(isDevelopment: true, CancellationToken.None);

        Assert.True(report.Executed);

        var truck = await _db.Vehicles.FirstAsync(v => v.Id == SeedIds.Vehicle714);
        Assert.Equal("714", truck.InternalNumber);
        Assert.Equal("Caminhão", truck.Type);

        var template = await _db.ChecklistTemplates
            .Include(t => t.Sections).ThenInclude(s => s.Items)
            .FirstAsync();

        Assert.True(template.Published);
        Assert.Equal(truck.Type, template.VehicleType);
        Assert.Equal(4, template.Sections.Count);
        Assert.Contains(template.Sections.SelectMany(s => s.Items), i => i.ResponseType == ResponseType.Measurement);
        Assert.All(template.Sections.SelectMany(s => s.Items), i => Assert.False(string.IsNullOrWhiteSpace(i.Label)));
    }

    [Fact]
    public async Task Running_the_seed_twice_changes_nothing()
    {
        await Seeder().RunAsync(isDevelopment: true, CancellationToken.None);

        var before = (
            Users: await _db.Users.CountAsync(),
            Vehicles: await _db.Vehicles.CountAsync(),
            Templates: await _db.ChecklistTemplates.CountAsync(),
            Items: await _db.ChecklistItems.CountAsync());

        _db.ChangeTracker.Clear();
        await Seeder().RunAsync(isDevelopment: true, CancellationToken.None);

        var after = (
            Users: await _db.Users.CountAsync(),
            Vehicles: await _db.Vehicles.CountAsync(),
            Templates: await _db.ChecklistTemplates.CountAsync(),
            Items: await _db.ChecklistItems.CountAsync());

        Assert.Equal(before, after);
    }

    [Fact]
    public async Task The_seed_provisions_used_types_and_preserves_catalog_retirement_on_restart()
    {
        await Seeder().RunAsync(isDevelopment: true, CancellationToken.None);
        var catalog = await _db.Set<VehicleType>().Where(t => t.CompanyId == SeedIds.Company).ToListAsync();
        Assert.Contains(catalog, t => t.Code == "Truck" && t.Active);
        var references = await _db.Vehicles.Select(v => v.Type)
            .Union(_db.ChecklistTemplates.Select(t => t.VehicleType)).ToListAsync();
        Assert.All(references, code => Assert.Contains(catalog, t => t.Code == code && t.Active));
        var retired = catalog.Single(t => t.Code == "Caminhão");
        retired.Active = false;
        retired.Name = "Preserved administrator label";
        await _db.SaveChangesAsync();
        var ids = catalog.Select(t => t.Id).Order().ToArray();

        _db.ChangeTracker.Clear();
        await Seeder().RunAsync(isDevelopment: true, CancellationToken.None);

        Assert.Equal(ids, await _db.Set<VehicleType>().Where(t => t.CompanyId == SeedIds.Company)
            .OrderBy(t => t.Id).Select(t => t.Id).ToArrayAsync());
        retired = await _db.Set<VehicleType>().SingleAsync(t => t.Id == retired.Id);
        Assert.False(retired.Active);
        Assert.Equal("Preserved administrator label", retired.Name);
    }

    [Fact]
    public async Task The_seed_stores_only_password_hashes()
    {
        await Seeder().RunAsync(isDevelopment: true, CancellationToken.None);

        var users = await _db.Users.ToListAsync();

        Assert.NotEmpty(users);
        Assert.All(users, u => Assert.DoesNotContain("dev-admin-password", u.PasswordHash, StringComparison.Ordinal));
        Assert.All(users, u => Assert.True(new PasswordHashing().Verify(u.PasswordHash, ExpectedPassword(u.Role))));
    }

    [Fact]
    public async Task Generated_passwords_are_written_to_the_local_credentials_file()
    {
        var path = Path.Combine(_directory, "generated.json");
        var report = await Seeder(new DevSeedOptions
        {
            Enabled = true,
            AdminUsername = "admin",
            CredentialsFilePath = path,
        }).RunAsync(isDevelopment: true, CancellationToken.None);

        Assert.Equal(4, report.GeneratedPasswords.Count);
        Assert.True(File.Exists(path));
        Assert.Contains("admin", await File.ReadAllTextAsync(path));
    }

    [Fact]
    public async Task The_seed_refuses_to_run_outside_development()
    {
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => Seeder().RunAsync(isDevelopment: false, CancellationToken.None));

        Assert.Equal(0, await _db.Vehicles.CountAsync());
    }

    [Fact]
    public async Task A_disabled_seed_does_nothing_even_in_development()
    {
        var report = await Seeder(new DevSeedOptions { Enabled = false })
            .RunAsync(isDevelopment: true, CancellationToken.None);

        Assert.False(report.Executed);
        Assert.Equal(0, await _db.Users.CountAsync());
    }

    private static string ExpectedPassword(UserRole role) => role switch
    {
        UserRole.Administrator => "dev-admin-password",
        UserRole.Supervisor => "dev-supervisor-password",
        UserRole.Inspector => "dev-inspector-password",
        _ => "dev-office-password",
    };
}
