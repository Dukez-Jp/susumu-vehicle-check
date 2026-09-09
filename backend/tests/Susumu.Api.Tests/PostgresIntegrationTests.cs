using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Seed;

namespace Susumu.Api.Tests;

/// <summary>
/// Runs the production provider end to end: versioned migrations build the schema, the DEV seed
/// creates the synthetic fixture, and the full workshop flow is exercised over HTTP.
/// Requires TEST_DATABASE_URL; see backend/README.md.
/// </summary>
[Collection(EnvironmentSensitiveCollection.Name)]
public sealed class PostgresIntegrationTests
{
    private const string Device = "tablet-postgres-01";
    private const string AdminPassword = "postgres-admin-password";
    private const string InspectorPassword = "postgres-inspector-password";

    [PostgresFact]
    public async Task Migrations_build_the_schema_from_scratch_and_leave_nothing_pending()
    {
        await using var db = CreateContext();
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();

        var applied = await db.Database.GetAppliedMigrationsAsync();
        var pending = await db.Database.GetPendingMigrationsAsync();

        Assert.NotEmpty(applied);
        Assert.Empty(pending);

        // The schema really exists, not just the history table.
        Assert.Equal(0, await db.Vehicles.CountAsync());
        Assert.Equal(0, await db.Inspections.CountAsync());
        Assert.Equal(0, await db.SyncOperations.CountAsync());
    }

    [PostgresFact]
    public async Task The_workshop_flow_works_end_to_end_on_postgresql()
    {
        await ResetDatabaseAsync();
        await using var factory = CreateFactory();

        var anonymous = factory.CreateClient();
        var inspector = await SignInAsync(factory, anonymous, "inspetor", InspectorPassword);

        // Vehicle 714 comes from the versioned DEV seed, not from a hand-inserted row.
        var vehicles = await Read<List<VehicleDto>>(await inspector.GetAsync("/api/v1/vehicles?search=714"));
        var truck = Assert.Single(vehicles);
        Assert.Equal(SeedIds.Vehicle714, truck.Id);

        var bootstrap = await Read<BootstrapResponse>(await inspector.GetAsync("/api/v1/bootstrap"));
        var template = Assert.Single(bootstrap.Templates, t => t.VehicleType == truck.Type);
        var items = template.Sections.SelectMany(s => s.Items).ToList();

        var answers = items
            .Select(i => new InspectionItemDto(
                i.Id,
                ItemStatus.OK,
                i.ResponseType == ResponseType.Measurement ? Midpoint(i) : null,
                null,
                null))
            .ToList();

        var inspectionId = Guid.NewGuid();
        var draftPayload = new InspectionDto(
            inspectionId, truck.Id, template.Id, template.Version, Device,
            (truck.CurrentOdometerKm ?? 0) + 120, InspectionState.Draft,
            DateTimeOffset.UtcNow, null, answers, "Fluxo completo", null, null, 0);

        var draft = await Read<SyncInspectionResponse>(await inspector.PostAsJsonAsync(
            "/api/v1/sync/inspections",
            new SyncInspectionRequest(Guid.NewGuid(), 0, draftPayload),
            SusumuJson.Options));

        Assert.Equal(1, draft.Version);

        var finalizeOperation = Guid.NewGuid();
        var finalizeRequest = new SyncInspectionRequest(
            finalizeOperation, 1, draftPayload with
            {
                State = InspectionState.Finalized,
                FinalizedAt = DateTimeOffset.UtcNow,
            });

        var finalized = await Read<SyncInspectionResponse>(await inspector.PostAsJsonAsync(
            "/api/v1/sync/inspections", finalizeRequest, SusumuJson.Options));
        Assert.Equal(InspectionState.Finalized, finalized.State);

        // Retry of the very same operation: same answer, no duplicate.
        var retry = await inspector.PostAsJsonAsync("/api/v1/sync/inspections", finalizeRequest, SusumuJson.Options);
        Assert.Equal("true", retry.Headers.GetValues("X-Susumu-Idempotent-Replay").Single());
        Assert.Equal(finalized, await Read<SyncInspectionResponse>(retry));

        var history = await Read<List<InspectionDto>>(
            await inspector.GetAsync($"/api/v1/inspections?vehicleId={truck.Id}"));
        Assert.Single(history);
        Assert.Equal(InspectionState.Finalized, history[0].State);

        await using (var db = CreateContext())
        {
            Assert.Equal(1, await db.Inspections.CountAsync());
            Assert.Equal(2, await db.SyncOperations.CountAsync());
            Assert.True(await db.AuditEntries.AnyAsync(a => a.InspectionId == inspectionId));
        }

        var admin = await SignInAsync(factory, anonymous, "admin", AdminPassword);
        var dashboard = await Read<DashboardResponse>(await admin.GetAsync("/api/v1/dashboard"));
        Assert.Equal(1, dashboard.Finalized);

        var csv = await (await admin.GetAsync("/api/v1/exports/inspections.csv")).Content.ReadAsStringAsync();
        Assert.Contains(inspectionId.ToString(), csv);
    }

    /// <summary>
    /// Integration ledger #2: two finalizations on one vehicle must not let the lower reading win.
    /// This is the case a single-threaded test cannot reach, so it runs on the real database.
    /// </summary>
    [PostgresFact]
    public async Task Concurrent_finalizations_on_one_vehicle_never_regress_the_odometer()
    {
        await ResetDatabaseAsync();
        await using var factory = CreateFactory();
        var anonymous = factory.CreateClient();
        var inspector = await SignInAsync(factory, anonymous, "inspetor", InspectorPassword);

        var (truck, template, answers) = await PrepareAsync(inspector);
        var start = truck.CurrentOdometerKm ?? 0;

        // The higher reading is submitted first so a lost update would leave the lower one stored.
        var high = FinalizedPayload(truck, template, answers, start + 5_000);
        var low = FinalizedPayload(truck, template, answers, start + 1_000);

        var responses = await Task.WhenAll(
            inspector.PostAsJsonAsync("/api/v1/sync/inspections",
                new SyncInspectionRequest(Guid.NewGuid(), 0, high), SusumuJson.Options),
            inspector.PostAsJsonAsync("/api/v1/sync/inspections",
                new SyncInspectionRequest(Guid.NewGuid(), 0, low), SusumuJson.Options));

        Assert.All(responses, r => Assert.True(
            r.StatusCode is HttpStatusCode.OK or HttpStatusCode.BadRequest or HttpStatusCode.Conflict,
            $"Unexpected status {(int)r.StatusCode}."));

        await using var db = CreateContext();
        var stored = await db.Vehicles.Where(v => v.Id == truck.Id).Select(v => v.CurrentOdometerKm).SingleAsync();
        var finalized = await db.Inspections
            .Where(i => i.State == InspectionState.Finalized)
            .Select(i => i.OdometerKm)
            .ToListAsync();

        // Whatever was accepted, the vehicle carries the highest accepted reading, never an older one.
        Assert.Equal(finalized.Max(), stored);
        Assert.True(stored >= start, "The odometer went backwards.");
    }

    /// <summary>
    /// Integration ledger #22: two administrators demoting each other at the same time must not be
    /// able to leave the company with none. A preflight count alone cannot prevent this.
    /// </summary>
    [PostgresFact]
    public async Task Concurrent_self_demotions_cannot_leave_a_company_without_an_administrator()
    {
        await ResetDatabaseAsync();
        await using var factory = CreateFactory();
        var anonymous = factory.CreateClient();
        var first = await SignInAsync(factory, anonymous, "admin", AdminPassword);

        var second = await Read<UserDto>(await first.PostAsJsonAsync("/api/v1/users",
            new CreateUserRequest("Segundo Admin", "admin2", AdminPassword, UserRole.Administrator, null),
            SusumuJson.Options));

        var secondClient = await SignInAsync(factory, anonymous, "admin2", AdminPassword);
        var firstId = (await Read<UserDto>(await first.GetAsync("/api/v1/auth/me"))).Id;

        var demotions = await Task.WhenAll(
            first.PutAsJsonAsync($"/api/v1/users/{second.Id}",
                new UpdateUserRequest(null, UserRole.Supervisor, null, null), SusumuJson.Options),
            secondClient.PutAsJsonAsync($"/api/v1/users/{firstId}",
                new UpdateUserRequest(null, UserRole.Supervisor, null, null), SusumuJson.Options));

        // Revocation can be observed during token validation (401), by the persisted actor check
        // after waiting for the company lock (403), or as a conflicting write (409). Whichever
        // layer observes it, exactly one demotion succeeds and the other administrator survives.
        Assert.All(demotions, r => Assert.True(
            r.StatusCode is HttpStatusCode.OK or HttpStatusCode.Conflict or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden,
            $"Unexpected status {(int)r.StatusCode}."));

        Assert.Single(demotions, r => r.StatusCode == HttpStatusCode.OK);

        await using var db = CreateContext();
        var remaining = await db.Users.CountAsync(u => u.Role == UserRole.Administrator && u.Active);

        Assert.Equal(1, remaining);
    }

    /// <summary>
    /// Integration ledger #3: a concurrent identical retry on an existing draft must replay the
    /// accepted operation, not return a conflict that would permanently block the device queue.
    /// </summary>
    [PostgresFact]
    public async Task Concurrent_identical_retries_on_an_existing_draft_all_replay_one_result()
    {
        await ResetDatabaseAsync();
        await using var factory = CreateFactory();
        var anonymous = factory.CreateClient();
        var inspector = await SignInAsync(factory, anonymous, "inspetor", InspectorPassword);

        var (truck, template, answers) = await PrepareAsync(inspector);
        var inspectionId = Guid.NewGuid();

        var draft = DraftPayload(inspectionId, truck, template, answers);
        await Read<SyncInspectionResponse>(await inspector.PostAsJsonAsync(
            "/api/v1/sync/inspections", new SyncInspectionRequest(Guid.NewGuid(), 0, draft), SusumuJson.Options));

        var update = new SyncInspectionRequest(
            Guid.NewGuid(), 1, draft with { Notes = "Retry under concurrency" });

        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ =>
            inspector.PostAsJsonAsync("/api/v1/sync/inspections", update, SusumuJson.Options)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

        var results = await Task.WhenAll(responses.Select(Read<SyncInspectionResponse>));
        Assert.Single(results.Select(r => r.Version).Distinct());
        Assert.Equal(2, results[0].Version);

        await using var db = CreateContext();
        Assert.Equal(1, await db.Inspections.CountAsync());
        Assert.Equal(2, await db.SyncOperations.CountAsync());
    }

    [PostgresFact]
    public async Task Readiness_reports_the_real_database_state()
    {
        await ResetDatabaseAsync();
        await using var factory = CreateFactory();
        var client = factory.CreateClient();

        var ready = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
    }

    /// <summary>Resolves the seeded truck, its published template and a complete set of answers.</summary>
    private static async Task<(VehicleDto Truck, ChecklistTemplateDto Template, List<InspectionItemDto> Answers)>
        PrepareAsync(HttpClient client)
    {
        var vehicles = await Read<List<VehicleDto>>(await client.GetAsync("/api/v1/vehicles?search=714"));
        var truck = vehicles.Single();

        var bootstrap = await Read<BootstrapResponse>(await client.GetAsync("/api/v1/bootstrap"));
        var template = bootstrap.Templates.Single(t => t.VehicleType == truck.Type);

        var answers = template.Sections
            .SelectMany(s => s.Items)
            .Select(i => new InspectionItemDto(
                i.Id,
                ItemStatus.OK,
                i.ResponseType == ResponseType.Measurement ? Midpoint(i) : null,
                null,
                null))
            .ToList();

        return (truck, template, answers);
    }

    private static InspectionDto DraftPayload(
        Guid id, VehicleDto truck, ChecklistTemplateDto template, IReadOnlyList<InspectionItemDto> answers)
        => new(
            id, truck.Id, template.Id, template.Version, Device,
            truck.CurrentOdometerKm ?? 0, InspectionState.Draft,
            DateTimeOffset.UtcNow, null, answers, null, null, null, 0);

    private static InspectionDto FinalizedPayload(
        VehicleDto truck, ChecklistTemplateDto template, IReadOnlyList<InspectionItemDto> answers, int odometerKm)
    {
        var now = DateTimeOffset.UtcNow;
        return new InspectionDto(
            Guid.NewGuid(), truck.Id, template.Id, template.Version, Device,
            odometerKm, InspectionState.Finalized,
            now.AddMinutes(-10), now, answers, null, null, null, 0);
    }

    private static decimal Midpoint(ChecklistItemDto item)
        => item.MinValue is { } min && item.MaxValue is { } max ? (min + max) / 2 : 1m;

    /// <summary>
    /// Every connection in this class goes through the guard, so an unapproved target is refused
    /// before a socket is opened rather than after.
    /// </summary>
    private static SusumuDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<SusumuDbContext>()
            .UseNpgsql(PostgresTestDatabase.RequireApprovedTarget())
            .Options;

        return new SusumuDbContext(options);
    }

    private static async Task ResetDatabaseAsync()
    {
        await using var db = CreateContext();
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
    }

    private static WebApplicationFactory<Program> CreateFactory()
        => new PostgresFactory();

    private static async Task<HttpClient> SignInAsync(
        WebApplicationFactory<Program> factory, HttpClient anonymous, string username, string password)
    {
        var response = await anonymous.PostAsJsonAsync(
            "/api/v1/auth/login", new LoginRequest(username, password, Device), SusumuJson.Options);

        response.EnsureSuccessStatusCode();
        var login = (await response.Content.ReadFromJsonAsync<LoginResponse>(SusumuJson.Options))!;

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.AccessToken);
        return client;
    }

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"Expected success but got {(int)response.StatusCode}: {body}");
        return System.Text.Json.JsonSerializer.Deserialize<T>(body, SusumuJson.Options)!;
    }

    /// <summary>
    /// Boots the API in Development so the documented seed path is what fills the database, while the
    /// schema itself was created by migrations.
    /// </summary>
    private sealed class PostgresFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("Susumu:IgnoreEnvironmentOverrides", "true");
            builder.UseSetting("Database:Provider", "postgres");
            builder.UseSetting("Database:ConnectionString", PostgresTestDatabase.RequireApprovedTarget());
            builder.UseSetting("Database:ApplyMigrationsAtStartup", "true");
            builder.UseSetting("Jwt:SigningKey", TestApp.SigningKey);
            builder.UseSetting("PhotoStorage:RootPath",
                Path.Combine(Path.GetTempPath(), "susumu-pg-photos", Guid.NewGuid().ToString("N")));
            builder.UseSetting("DevSeed:Enabled", "true");
            builder.UseSetting("DevSeed:AdminUsername", "admin");
            builder.UseSetting("DevSeed:AdminPassword", AdminPassword);
            builder.UseSetting("DevSeed:SupervisorPassword", "postgres-supervisor-password");
            builder.UseSetting("DevSeed:InspectorPassword", InspectorPassword);
            builder.UseSetting("DevSeed:OfficePassword", "postgres-office-password");
            builder.UseSetting("DevSeed:CredentialsFilePath",
                Path.Combine(Path.GetTempPath(), "susumu-pg-credentials", Guid.NewGuid().ToString("N"), "creds.json"));
        }
    }
}
