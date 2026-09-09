using System.Net;
using System.Text;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Tests;

public sealed class ReportingTests : ApiTestBase
{
    [Fact]
    public async Task The_dashboard_counts_only_what_the_caller_may_see()
    {
        var inspector = await App.SignInAsync("inspector");
        var draftId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(draftId, CompleteItems(photoIds: [photoId]))));

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(),
                CompleteItems(brakeStatus: ItemStatus.Critical),
                InspectionState.Finalized,
                odometerKm: 101_000)));

        var otherLocation = await App.SignInAsync("inspector-b", "tablet-b");
        await otherLocation.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), [], vehicleId: Fixture.OtherLocationVehicleId, deviceId: "tablet-b")));

        var dashboard = await (await inspector.GetAsync("/api/v1/dashboard")).ReadAsync<DashboardResponse>();

        Assert.Equal(1, dashboard.Vehicles);
        Assert.Equal(2, dashboard.Inspections);
        Assert.Equal(1, dashboard.Drafts);
        Assert.Equal(1, dashboard.Finalized);
        Assert.Equal(1, dashboard.CriticalItems);
        Assert.Equal(1, dashboard.PendingPhotos);
        Assert.Equal(2, dashboard.RecentInspections.Count);

        var adminDashboard = await (await (await App.SignInAsync("admin")).GetAsync("/api/v1/dashboard"))
            .ReadAsync<DashboardResponse>();
        Assert.Equal(3, adminDashboard.Inspections);
    }

    [Fact]
    public async Task The_csv_export_neutralizes_spreadsheet_formulas()
    {
        var admin = await App.SignInAsync("admin");
        await admin.PostJsonAsync("/api/v1/vehicles",
            new VehicleWriteRequest("=HYPERLINK(\"http://evil\",\"x\")", null, "Caminhão", null, null, true));

        var csv = await (await admin.GetAsync("/api/v1/exports/inspections.csv")).Content.ReadAsStringAsync();

        Assert.DoesNotContain("\n=", csv);
        Assert.DoesNotContain(",=", csv);
    }

    [Fact]
    public async Task Csv_cells_are_escaped_and_never_execute_or_break_the_row()
    {
        Assert.Equal("\"'=1+1\"", ReportingService.Cell("=1+1"));
        Assert.Equal("\"'+cmd\"", ReportingService.Cell("+cmd"));
        Assert.Equal("\"'-2\"", ReportingService.Cell("-2"));
        Assert.Equal("\"'@ref\"", ReportingService.Cell("@ref"));
        Assert.Equal("\"a\"\"b\"", ReportingService.Cell("a\"b"));
        Assert.Equal("\"line1\nline2\"", ReportingService.Cell("line1\nline2"));
    }

    [Fact]
    public async Task The_export_contains_one_row_per_inspection_item()
    {
        var inspector = await App.SignInAsync("inspector");
        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        var csv = await (await inspector.GetAsync("/api/v1/exports/inspections.csv")).Content.ReadAsStringAsync();
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(3, lines.Length);
        Assert.Contains("itemLabel", lines[0]);
        Assert.Contains("Freio de estacionamento", csv);
        Assert.Contains("620", csv);
    }

    [Fact]
    public async Task The_export_is_utf8_with_a_bom_so_accents_survive_excel()
    {
        var inspector = await App.SignInAsync("inspector");
        var response = await inspector.GetAsync("/api/v1/exports/inspections.csv");
        var bytes = await response.Content.ReadAsByteArrayAsync();

        Assert.Equal(Encoding.UTF8.GetPreamble(), bytes.Take(3).ToArray());
    }

    [Fact]
    public async Task Only_reviewers_can_read_the_audit_log()
    {
        var inspector = await App.SignInAsync("inspector");
        var supervisor = await App.SignInAsync("supervisor");

        Assert.Equal(HttpStatusCode.Forbidden, (await inspector.GetAsync("/api/v1/audit")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await supervisor.GetAsync("/api/v1/audit")).StatusCode);
    }

    [Fact]
    public async Task The_audit_of_one_inspection_shows_creation_and_finalization()
    {
        var inspector = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems())));
        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        var supervisor = await App.SignInAsync("supervisor");
        var audit = await (await supervisor.GetAsync($"/api/v1/audit?inspectionId={id}"))
            .ReadAsync<List<AuditEntryDto>>();

        Assert.Contains(audit, a => a.Action == "inspection.created");
        Assert.Contains(audit, a => a.Action == "inspection.finalized");
        Assert.All(audit, a => Assert.Equal(Fixture.InspectorId, a.ActorId));
    }

    [Fact]
    public async Task A_supervisor_does_not_see_audit_rows_from_another_location()
    {
        var otherLocation = await App.SignInAsync("inspector-b", "tablet-b");
        var foreignId = Guid.NewGuid();
        await otherLocation.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                foreignId, [], vehicleId: Fixture.OtherLocationVehicleId, deviceId: "tablet-b")));

        var supervisor = await App.SignInAsync("supervisor");
        var visible = await (await supervisor.GetAsync("/api/v1/audit")).ReadAsync<List<AuditEntryDto>>();
        Assert.DoesNotContain(visible, a => a.EntityId == foreignId);

        var admin = await App.SignInAsync("admin");
        var companyWide = await (await admin.GetAsync("/api/v1/audit")).ReadAsync<List<AuditEntryDto>>();
        Assert.Contains(companyWide, a => a.EntityId == foreignId);
    }

    [Fact]
    public async Task A_wildcard_search_does_not_widen_the_vehicle_result_set()
    {
        var client = await App.SignInAsync("inspector");

        var wildcard = await (await client.GetAsync("/api/v1/vehicles?search=%25")).ReadAsync<List<VehicleDto>>();

        Assert.Empty(wildcard);
    }

    [Fact]
    public async Task The_audit_of_an_out_of_scope_inspection_is_not_disclosed()
    {
        var otherLocation = await App.SignInAsync("inspector-b", "tablet-b");
        var id = Guid.NewGuid();
        await otherLocation.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                id, [], vehicleId: Fixture.OtherLocationVehicleId, deviceId: "tablet-b")));

        var supervisor = await App.SignInAsync("supervisor");
        var response = await supervisor.GetAsync($"/api/v1/audit?inspectionId={id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}

public sealed class HealthTests : ApiTestBase
{
    [Fact]
    public async Task Liveness_and_readiness_answer_without_authentication()
    {
        var live = await App.Anonymous.GetAsync("/health/live");
        var ready = await App.Anonymous.GetAsync("/api/v1/health/ready");

        Assert.Equal(HttpStatusCode.OK, live.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
    }

    [Fact]
    public async Task Health_responses_expose_no_configuration()
    {
        var body = await (await App.Anonymous.GetAsync("/health/ready")).Content.ReadAsStringAsync();

        Assert.DoesNotContain("Data Source", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SigningKey", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(TestApp.SigningKey, body, StringComparison.Ordinal);
    }
}
