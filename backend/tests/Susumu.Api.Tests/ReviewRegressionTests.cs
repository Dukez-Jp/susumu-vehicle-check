using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Seed;
using Susumu.Infrastructure.Services;
using Susumu.Infrastructure.Time;

namespace Susumu.Api.Tests;

/// <summary>
/// One regression per item of docs/INTEGRATION_REVIEW.md that changed behaviour. Item numbers are
/// quoted in each name so a reviewer can map a test back to the finding it closes.
/// </summary>
public sealed class SyncReviewRegressionTests : ApiTestBase
{
    [Fact] // #1
    public async Task Creating_an_inspection_with_a_non_zero_expected_version_is_refused()
    {
        var client = await App.SignInAsync("inspector");

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 3, Inspection(Guid.NewGuid(), CompleteItems())));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("expectedVersion"));
        Assert.Equal(0, await App.WithDbAsync(db => db.Inspections.CountAsync()));
    }

    [Fact] // #15 of the ledger's version invariant: exactly one increment per accepted operation
    public async Task Each_accepted_operation_increments_the_version_by_exactly_one_and_replays_do_not()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();
        var operationId = Guid.NewGuid();

        var first = await (await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(operationId, 0, Inspection(id, CompleteItems())))).ReadAsync<SyncInspectionResponse>();
        Assert.Equal(1, first.Version);

        var replay = await (await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(operationId, 0, Inspection(id, CompleteItems())))).ReadAsync<SyncInspectionResponse>();
        Assert.Equal(1, replay.Version);

        var second = await (await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, CompleteItems(pressure: 630m))))).ReadAsync<SyncInspectionResponse>();
        Assert.Equal(2, second.Version);

        var third = await (await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 2, Inspection(id, CompleteItems(pressure: 640m))))).ReadAsync<SyncInspectionResponse>();
        Assert.Equal(3, third.Version);
    }

    [Fact] // #4
    public async Task A_measurement_with_more_precision_than_is_stored_is_refused_rather_than_rounded()
    {
        var client = await App.SignInAsync("inspector");

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), CompleteItems(pressure: 620.00001m))));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("4 decimal places",
            string.Join(' ', (await response.ReadProblemAsync()).Errors!.Values.SelectMany(v => v)));
    }

    [Fact] // #4
    public async Task Four_decimal_places_are_accepted_and_stored_exactly()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems(pressure: 620.1234m))));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var stored = await App.WithDbAsync(db => db.InspectionItems
            .FirstAsync(i => i.InspectionId == id && i.ItemId == Fixture.RequiredMeasurementItemId));
        Assert.Equal(620.1234m, stored.Value);
    }

    [Fact] // #5
    public async Task A_numeric_or_undefined_enum_value_is_refused()
    {
        var client = await App.SignInAsync("inspector");
        var body = BuildRawOperation(status: "999");

        var numeric = await PostRawAsync(client, body);
        Assert.Equal(HttpStatusCode.BadRequest, numeric.StatusCode);

        var undefined = await PostRawAsync(client, BuildRawOperation(status: "\"Excellent\""));
        Assert.Equal(HttpStatusCode.BadRequest, undefined.StatusCode);
    }

    [Fact] // #5
    public async Task An_item_without_a_status_is_refused_instead_of_being_recorded_as_OK()
    {
        var client = await App.SignInAsync("inspector");

        var response = await PostRawAsync(client, BuildRawOperation(status: null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("status", string.Join(' ', (await response.ReadProblemAsync()).Errors!.Keys));
        Assert.Equal(0, await App.WithDbAsync(db => db.InspectionItems.CountAsync()));
    }

    [Fact] // #6
    public async Task The_client_timestamps_are_kept_verbatim_and_receivedAt_is_the_server_time()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();
        var started = new DateTimeOffset(2026, 9, 9, 6, 15, 30, TimeSpan.Zero);
        var finalized = started.AddMinutes(42);

        var payload = Inspection(id, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000) with
        {
            StartedAt = started,
            FinalizedAt = finalized,
        };

        await client.PostJsonAsync("/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, payload));

        var stored = await (await client.GetAsync($"/api/v1/inspections/{id}")).ReadAsync<InspectionDto>();

        Assert.Equal(started, stored.StartedAt);
        Assert.Equal(finalized, stored.FinalizedAt);
        Assert.NotEqual(started, stored.ReceivedAt);
        Assert.True(stored.ReceivedAt > started);
    }

    [Fact] // #6
    public async Task A_missing_or_default_startedAt_is_refused()
    {
        var client = await App.SignInAsync("inspector");

        var payload = Inspection(Guid.NewGuid(), CompleteItems()) with { StartedAt = default };
        var response = await client.PostJsonAsync("/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, payload));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("inspection.startedAt"));
    }

    [Fact] // #6
    public async Task A_device_clock_far_from_the_server_is_accepted_but_audited()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();
        var skewed = DateTimeOffset.UtcNow.AddHours(-9);

        var payload = Inspection(id, CompleteItems()) with { StartedAt = skewed };
        var response = await client.PostJsonAsync("/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, payload));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var stored = await App.WithDbAsync(db => db.Inspections.FirstAsync(i => i.Id == id));
        Assert.Equal(skewed.UtcDateTime, stored.StartedAt.UtcDateTime, TimeSpan.FromMilliseconds(1));

        var skewAudit = await App.WithDbAsync(db => db.AuditEntries
            .FirstOrDefaultAsync(a => a.Action == AuditActions.InspectionClockSkew && a.InspectionId == id));
        Assert.NotNull(skewAudit);
        Assert.Contains("differenceSeconds", skewAudit!.Details);
    }

    [Fact] // #9
    public async Task An_inspection_cannot_be_finalized_before_it_was_started()
    {
        var client = await App.SignInAsync("inspector");

        var payload = Inspection(Guid.NewGuid(), CompleteItems(), InspectionState.Finalized, odometerKm: 101_000) with
        {
            FinalizedAt = StartedAt.AddMinutes(-30),
        };

        var response = await client.PostJsonAsync("/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, payload));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("inspection.finalizedAt"));
    }

    [Fact] // #9
    public async Task A_vehicle_with_no_recorded_reading_accepts_a_legitimate_zero_odometer()
    {
        var admin = await App.SignInAsync("admin");
        var vehicle = await (await admin.PostJsonAsync("/api/v1/vehicles",
            new VehicleWriteRequest("990", null, "Caminhão", null, null, true))).ReadAsync<VehicleDto>();

        Assert.Null(vehicle.CurrentOdometerKm);

        var client = await App.SignInAsync("inspector");
        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), InspectionState.Finalized,
                odometerKm: 0, vehicleId: vehicle.Id)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact] // #9
    public void The_implausible_jump_ceiling_cannot_overflow_near_int_max()
    {
        var errors = new Dictionary<string, string[]>();

        InspectionSyncService.ValidateOdometerForFinalization(
            int.MaxValue, int.MaxValue - 10, errors);

        // Without long arithmetic the ceiling wraps negative and every reading looks like a jump.
        Assert.Empty(errors);
    }

    [Fact] // #7
    public async Task One_photo_declared_on_two_items_is_refused()
    {
        var client = await App.SignInAsync("inspector");
        var shared = Guid.NewGuid();

        var items = new List<InspectionItemDto>
        {
            new(Fixture.RequiredStatusItemId, ItemStatus.OK, null, null, [shared]),
            new(Fixture.RequiredMeasurementItemId, ItemStatus.OK, 620m, null, [shared]),
        };

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), items)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("more than one item",
            string.Join(' ', (await response.ReadProblemAsync()).Errors!.Values.SelectMany(v => v)));
    }

    [Fact] // #7
    public async Task Moving_a_declared_photo_to_another_item_is_refused()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems(photoIds: [photoId]))));

        var moved = new List<InspectionItemDto>
        {
            new(Fixture.RequiredStatusItemId, ItemStatus.OK, null, null, null),
            new(Fixture.RequiredMeasurementItemId, ItemStatus.OK, 620m, null, [photoId]),
        };

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, moved)));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("rebound", (await response.ReadProblemAsync()).Detail);
    }

    [Fact] // #8
    public async Task Oversized_free_text_and_photo_counts_are_refused_before_any_write()
    {
        var client = await App.SignInAsync("inspector");

        var longReason = new string('x', InspectionSyncService.MaxCorrectionReasonLength + 1);
        var reason = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), correctionReason: longReason)));
        Assert.Equal(HttpStatusCode.BadRequest, reason.StatusCode);

        var manyPhotos = Enumerable.Range(0, InspectionSyncService.MaxPhotosPerItem + 1)
            .Select(_ => Guid.NewGuid()).ToList();
        var photos = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), CompleteItems(photoIds: manyPhotos))));
        Assert.Equal(HttpStatusCode.BadRequest, photos.StatusCode);

        Assert.Equal(0, await App.WithDbAsync(db => db.Inspections.CountAsync()));
    }

    [Fact] // #20 — the failure the root PostgreSQL smoke actually caught
    public async Task ResponseType_is_serialized_lowercase_on_the_real_http_response()
    {
        var client = await App.SignInAsync("inspector");

        var bootstrap = await (await client.GetAsync("/api/v1/bootstrap")).Content.ReadAsStringAsync();

        Assert.Contains("\"responseType\":\"status\"", bootstrap);
        Assert.Contains("\"responseType\":\"measurement\"", bootstrap);
        Assert.DoesNotContain("\"responseType\":\"Status\"", bootstrap);
        Assert.DoesNotContain("\"responseType\":\"Measurement\"", bootstrap);

        // Other enums keep their exact contract spelling.
        Assert.Contains("\"role\":\"Inspector\"", bootstrap);
    }

    [Fact] // #20 — the lowercase form must also be accepted on input
    public async Task ResponseType_is_accepted_lowercase_on_input()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var body = """
        {
          "name": "Lowercase round trip",
          "vehicleType": "Caminhão",
          "requiresSignature": false,
          "sections": [
            { "title": "Seção", "items": [
              { "label": "Medida", "responseType": "measurement", "required": true, "unit": "kPa" }
            ] }
          ]
        }
        """;

        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await supervisor.PostAsync("/api/v1/templates", content);

        var template = await response.ReadAsync<ChecklistTemplateDto>();
        Assert.Equal(ResponseType.Measurement, template.Sections[0].Items[0].ResponseType);
    }

    [Fact] // client review MEDIUM 5
    public async Task A_superseded_inspection_reports_its_correction_directly()
    {
        var client = await App.SignInAsync("inspector");
        var originalId = Guid.NewGuid();
        var correctionId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                originalId, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                correctionId, CompleteItems(brakeStatus: ItemStatus.Repair), InspectionState.Finalized,
                odometerKm: 101_010, supersedes: originalId, correctionReason: "Reavaliação do freio")));

        var original = await (await client.GetAsync($"/api/v1/inspections/{originalId}")).ReadAsync<InspectionDto>();
        var correction = await (await client.GetAsync($"/api/v1/inspections/{correctionId}")).ReadAsync<InspectionDto>();

        Assert.Equal(correctionId, original.SupersededByInspectionId);
        Assert.Null(correction.SupersededByInspectionId);
    }

    private string BuildRawOperation(string? status)
    {
        var statusJson = status is null ? string.Empty : $"\"status\": {status},";

        return $$"""
        {
          "operationId": "{{Guid.NewGuid()}}",
          "expectedVersion": 0,
          "inspection": {
            "id": "{{Guid.NewGuid()}}",
            "vehicleId": "{{Fixture.TruckId}}",
            "templateId": "{{Fixture.TemplateId}}",
            "templateVersion": 1,
            "deviceId": "{{Device}}",
            "odometerKm": 100500,
            "state": "Draft",
            "startedAt": "2026-09-09T08:30:00+00:00",
            "finalizedAt": null,
            "items": [ { "itemId": "{{Fixture.RequiredStatusItemId}}", {{statusJson}} "value": null, "notes": null, "photoIds": [] } ],
            "notes": null,
            "supersedesInspectionId": null,
            "correctionReason": null,
            "version": 0
          }
        }
        """;
    }

    private static async Task<HttpResponseMessage> PostRawAsync(HttpClient client, string body)
    {
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        return await client.PostAsync("/api/v1/sync/inspections", content);
    }
}

public sealed class AuthReviewRegressionTests : ApiTestBase
{
    [Fact] // #23
    public async Task An_inactive_company_blocks_both_new_logins_and_tokens_already_issued()
    {
        var client = await App.SignInAsync("inspector");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/auth/me")).StatusCode);

        await App.WithDbAsync(async db =>
        {
            var company = await db.Companies.FirstAsync(c => c.Id == Fixture.CompanyId);
            company.Active = false;
            await db.SaveChangesAsync();
        });

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/me")).StatusCode);

        var login = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", TestApp.Password, Device));
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact] // #23
    public async Task An_inactive_location_blocks_both_new_logins_and_tokens_already_issued()
    {
        var client = await App.SignInAsync("inspector");

        await App.WithDbAsync(async db =>
        {
            var location = await db.Locations.FirstAsync(l => l.Id == Fixture.LocationId);
            location.Active = false;
            await db.SaveChangesAsync();
        });

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/me")).StatusCode);

        var login = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", TestApp.Password, Device));
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact] // #24
    public async Task A_create_user_request_without_a_role_is_refused_instead_of_creating_an_administrator()
    {
        var admin = await App.SignInAsync("admin");
        const string body = """
        { "name": "Sem papel", "username": "sem-papel", "password": "password-1234", "locationId": null }
        """;

        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await admin.PostAsync("/api/v1/users", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("role"));
        Assert.False(await App.WithDbAsync(db => db.Users.AnyAsync(u => u.Username == "sem-papel")));
    }

    [Fact] // #24
    public async Task A_numeric_role_is_refused()
    {
        var admin = await App.SignInAsync("admin");
        const string body = """
        { "name": "Numerico", "username": "numerico", "password": "password-1234", "role": 0, "locationId": null }
        """;

        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await admin.PostAsync("/api/v1/users", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(await App.WithDbAsync(db => db.Users.AnyAsync(u => u.Username == "numerico")));
    }

    [Fact] // #26
    public async Task An_oversized_username_or_password_is_refused_before_hashing_or_auditing()
    {
        var longUsername = new string('u', AuthService.MaxUsernameLength + 500);
        var longPassword = new string('p', AuthService.MaxPasswordLength + 5_000);

        var username = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest(longUsername, "whatever", Device));
        var password = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", longPassword, Device));

        Assert.Equal(HttpStatusCode.BadRequest, username.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, password.StatusCode);

        // Nothing reached the bounded audit column, and no submitted password was recorded.
        var audits = await App.WithDbAsync(db => db.AuditEntries.ToListAsync());
        Assert.DoesNotContain(audits, a => a.Action == AuditActions.LoginFailed);
        Assert.DoesNotContain(audits, a => a.Details is not null && a.Details.Contains(longPassword[..50]));
    }

    [Fact] // #25
    public async Task One_locked_out_account_does_not_lock_out_the_rest_of_a_shared_proxy_address()
    {
        var options = new LoginThrottleOptions();

        for (var attempt = 0; attempt <= options.MaxAccountFailures; attempt++)
        {
            await App.Anonymous.PostJsonAsync(
                "/api/v1/auth/login", new LoginRequest("inspector", "wrong-password", Device));
        }

        var locked = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", TestApp.Password, Device));
        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);

        // Every other tablet behind the same proxy address keeps working.
        var colleague = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("supervisor", TestApp.Password, Device));
        Assert.Equal(HttpStatusCode.OK, colleague.StatusCode);
    }

    [Fact] // #25
    public void Spraying_many_accounts_from_one_source_is_still_blocked()
    {
        var options = Options.Create(new LoginThrottleOptions());
        var clock = new SystemClock();
        using var cache = new Microsoft.Extensions.Caching.Memory.MemoryCache(
            new Microsoft.Extensions.Caching.Memory.MemoryCacheOptions());
        var throttle = new LoginThrottle(cache, clock, options);

        for (var i = 0; i < options.Value.MaxSourceDistinctAccounts; i++)
        {
            throttle.RegisterFailure($"victim{i}", "10.0.0.9");
        }

        Assert.Throws<TooManyRequestsException>(() => throttle.EnsureNotBlocked("someone-else", "10.0.0.9"));
    }

    [Fact] // #22 (single-process arm; the concurrent arm runs on PostgreSQL)
    public async Task The_company_administration_stamp_advances_on_every_account_change()
    {
        var admin = await App.SignInAsync("admin");
        var before = await App.WithDbAsync(db => db.Companies
            .Where(c => c.Id == Fixture.CompanyId).Select(c => c.AdministrationStamp).FirstAsync());

        await admin.PutJsonAsync($"/api/v1/users/{Fixture.InspectorId}",
            new UpdateUserRequest("Renomeado", null, null, null));

        var after = await App.WithDbAsync(db => db.Companies
            .Where(c => c.Id == Fixture.CompanyId).Select(c => c.AdministrationStamp).FirstAsync());

        Assert.True(after > before);
    }
}

public sealed class VehicleAndReportingReviewRegressionTests : ApiTestBase
{
    [Fact] // extra odometer finding
    public async Task An_administrative_edit_cannot_put_back_an_older_odometer_reading()
    {
        var admin = await App.SignInAsync("admin");
        var vehicle = await (await admin.GetAsync($"/api/v1/vehicles/{Fixture.TruckId}")).ReadAsync<VehicleDto>();
        var staleReading = vehicle.CurrentOdometerKm!.Value;

        // A finalization moves the meter forward while the web edit form is still open.
        var inspector = await App.SignInAsync("inspector");
        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), InspectionState.Finalized, odometerKm: staleReading + 900)));

        // The stale edit posts the reading it saw.
        var response = await admin.PutJsonAsync($"/api/v1/vehicles/{Fixture.TruckId}",
            new VehicleWriteRequest(null, null, null, null, staleReading, null));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var current = await App.WithDbAsync(db => db.Vehicles
            .Where(v => v.Id == Fixture.TruckId).Select(v => v.CurrentOdometerKm).FirstAsync());
        Assert.Equal(staleReading + 900, current);
    }

    [Fact] // #17
    public async Task Dashboard_pending_photos_counts_inspections_not_photo_rows()
    {
        var client = await App.SignInAsync("inspector");

        // One inspection with three undelivered photos must count as one.
        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(),
                CompleteItems(photoIds: [Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()]))));

        var dashboard = await (await client.GetAsync("/api/v1/dashboard")).ReadAsync<DashboardResponse>();

        Assert.Equal(1, dashboard.PendingPhotos);
    }

    [Fact] // #18
    public void Formula_markers_behind_leading_whitespace_are_neutralized()
    {
        Assert.StartsWith("\"'", ReportingService.Cell(" =1+1"));
        Assert.StartsWith("\"'", ReportingService.Cell("\t@ref"));
        Assert.StartsWith("\"'", ReportingService.Cell("\r\n+cmd"));
        Assert.StartsWith("\"'", ReportingService.Cell("\0=danger"));

        // Ordinary text is left alone.
        Assert.Equal("\" leading space\"", ReportingService.Cell(" leading space"));
    }

    [Fact] // #18
    public async Task An_export_larger_than_the_limit_is_refused_with_a_filter_instruction()
    {
        using var scope = App.CreateScope();
        var reporting = scope.ServiceProvider.GetRequiredService<ReportingService>();
        var actor = new CurrentUser(
            Fixture.AdminId, Fixture.CompanyId, Fixture.LocationId, UserRole.Administrator, "Admin", "admin");

        var db = scope.ServiceProvider.GetRequiredService<SusumuDbContext>();
        await SeedInspectionsAsync(db, ReportingService.MaxExportRows + 1);

        var error = await Assert.ThrowsAsync<AppException>(
            () => reporting.InspectionsCsvAsync(actor, null, null, default));

        Assert.Equal(400, error.Status);
        Assert.Contains("Narrow it", error.Detail);
    }

    private async Task SeedInspectionsAsync(SusumuDbContext db, int count)
    {
        var now = DateTimeOffset.UtcNow;
        for (var i = 0; i < count; i++)
        {
            db.Inspections.Add(new Inspection
            {
                Id = Guid.NewGuid(),
                CompanyId = Fixture.CompanyId,
                LocationId = Fixture.LocationId,
                VehicleId = Fixture.TruckId,
                TemplateId = Fixture.TemplateId,
                TemplateVersion = 1,
                DeviceId = Device,
                OdometerKm = 100_000,
                State = InspectionState.Draft,
                StartedAt = now.AddMinutes(-i),
                Version = 1,
                CreatedByUserId = Fixture.InspectorId,
                ReceivedAt = now,
                UpdatedAt = now,
            });
        }

        await db.SaveChangesAsync();
    }
}

public sealed class ProvisioningTests : IAsyncLifetime
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "susumu-provision", Guid.NewGuid().ToString("N"));
    private SusumuDbContext _db = null!;

    public async Task InitializeAsync()
    {
        Directory.CreateDirectory(_directory);
        var options = new DbContextOptionsBuilder<SusumuDbContext>()
            .UseSqlite($"Data Source={Path.Combine(_directory, "provision.db")}")
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
        }
    }

    private InitialProvisioning Service() => new(_db, new PasswordHashing(), new SystemClock());

    private static ProvisioningRequest Request(string username = "operador") =>
        new("Susumu Sabisu", "Oficina Central", "Operador", username, "operator-password-1");

    [Fact] // #19
    public async Task An_empty_installation_gets_one_company_location_and_administrator()
    {
        var result = await Service().RunAsync(Request(), CancellationToken.None);

        var admin = await _db.Users.SingleAsync();
        Assert.Equal(UserRole.Administrator, admin.Role);
        Assert.Equal(result.AdminUserId, admin.Id);
        Assert.Equal(result.CompanyId, admin.CompanyId);
        Assert.Equal(result.LocationId, admin.LocationId);

        Assert.True(new PasswordHashing().Verify(admin.PasswordHash, "operator-password-1"));
        Assert.DoesNotContain("operator-password-1", admin.PasswordHash, StringComparison.Ordinal);

        var audit = await _db.AuditEntries.SingleAsync();
        Assert.Equal(AuditActions.InitialProvisioning, audit.Action);
        Assert.DoesNotContain("operator-password-1", audit.Details ?? string.Empty, StringComparison.Ordinal);
    }

    [Fact] // #19
    public async Task It_refuses_to_run_against_a_database_that_already_has_accounts()
    {
        await Service().RunAsync(Request(), CancellationToken.None);
        _db.ChangeTracker.Clear();

        var error = await Assert.ThrowsAsync<InvalidOperationException>(
            () => Service().RunAsync(Request("outro"), CancellationToken.None));

        Assert.Contains("already contains user accounts", error.Message);
        Assert.Equal(1, await _db.Users.CountAsync());
    }

    [Fact] // #19
    public async Task A_weak_or_missing_secret_is_refused()
    {
        await Assert.ThrowsAsync<AppException>(
            () => Service().RunAsync(Request() with { AdminPassword = "short" }, CancellationToken.None));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => Service().RunAsync(Request() with { CompanyName = "  " }, CancellationToken.None));

        Assert.Equal(0, await _db.Users.CountAsync());
    }
}
