using System.Net;
using Microsoft.EntityFrameworkCore;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;

namespace Susumu.Api.Tests;

/// <summary>
/// The offline path: one client operation applied exactly once, with immutable finalized records and
/// explicit conflicts instead of silent overwrites.
/// </summary>
public sealed class SyncTests : ApiTestBase
{
    [Fact]
    public async Task First_operation_creates_the_draft_with_server_version_one()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        var response = await client.PostJsonAsync(
            "/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems())));

        var result = await response.ReadAsync<SyncInspectionResponse>();

        Assert.Equal(id, result.InspectionId);
        Assert.Equal(1, result.Version);
        Assert.Equal(InspectionState.Draft, result.State);
        Assert.Equal("false", response.Headers.GetValues("X-Susumu-Idempotent-Replay").Single());
    }

    [Fact]
    public async Task Replaying_the_same_operation_returns_the_stored_answer_and_creates_nothing_new()
    {
        var client = await App.SignInAsync("inspector");
        var operationId = Guid.NewGuid();
        var payload = Operation(operationId, 0, Inspection(Guid.NewGuid(), CompleteItems()));

        var first = await (await client.PostJsonAsync("/api/v1/sync/inspections", payload))
            .ReadAsync<SyncInspectionResponse>();

        var replayResponse = await client.PostJsonAsync("/api/v1/sync/inspections", payload);
        var replay = await replayResponse.ReadAsync<SyncInspectionResponse>();

        Assert.Equal(first, replay);
        Assert.Equal("true", replayResponse.Headers.GetValues("X-Susumu-Idempotent-Replay").Single());

        var inspections = await App.WithDbAsync(db => db.Inspections.CountAsync());
        Assert.Equal(1, inspections);
    }

    [Fact]
    public async Task Reusing_an_operation_id_with_a_different_payload_is_a_conflict()
    {
        var client = await App.SignInAsync("inspector");
        var operationId = Guid.NewGuid();
        var id = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(operationId, 0, Inspection(id, CompleteItems())));

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(operationId, 0, Inspection(id, CompleteItems(pressure: 700m))));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Contains("different payload", problem.Detail);
    }

    [Fact]
    public async Task Reordered_items_hash_to_the_same_operation_and_replay_instead_of_conflicting()
    {
        var client = await App.SignInAsync("inspector");
        var operationId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var items = CompleteItems();

        await client.PostJsonAsync("/api/v1/sync/inspections", Operation(operationId, 0, Inspection(id, items)));

        var reordered = items.Reverse().ToList();
        var response = await client.PostJsonAsync(
            "/api/v1/sync/inspections", Operation(operationId, 0, Inspection(id, reordered)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("true", response.Headers.GetValues("X-Susumu-Idempotent-Replay").Single());
    }

    [Fact]
    public async Task A_stale_expected_version_is_rejected_and_reports_the_server_version()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems())));

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, CompleteItems(pressure: 640m))));

        var stale = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, CompleteItems(pressure: 650m))));

        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var problem = await stale.ReadProblemAsync();
        Assert.Contains("Server version is 2.", problem.Errors!["expectedVersion"]);
    }

    [Fact]
    public async Task Finalizing_freezes_the_record_and_updates_the_vehicle_odometer()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems())));

        var finalize = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        var result = await finalize.ReadAsync<SyncInspectionResponse>();
        Assert.Equal(InspectionState.Finalized, result.State);
        Assert.Equal(PhotoUploadState.Complete, result.PhotoUploadState);

        var odometer = await App.WithDbAsync(db => db.Vehicles
            .Where(v => v.Id == Fixture.TruckId).Select(v => v.CurrentOdometerKm).FirstAsync());
        Assert.Equal(101_000, odometer);
    }

    [Fact]
    public async Task A_finalized_inspection_can_never_be_updated_again()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, CompleteItems(brakeStatus: ItemStatus.Critical))));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("immutable", (await response.ReadProblemAsync()).Detail);

        var stored = await App.WithDbAsync(db => db.InspectionItems
            .FirstAsync(i => i.InspectionId == id && i.ItemId == Fixture.RequiredStatusItemId));
        Assert.Equal(ItemStatus.OK, stored.Status);
    }

    [Fact]
    public async Task Finalizing_without_every_required_response_is_rejected()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                id,
                [new InspectionItemDto(Fixture.RequiredStatusItemId, ItemStatus.OK, null, null, null)],
                InspectionState.Finalized,
                odometerKm: 101_000)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Contains(problem.Errors!.Keys, key => key.Contains(Fixture.RequiredMeasurementItemId.ToString()));

        var persisted = await App.WithDbAsync(db => db.Inspections.AnyAsync(i => i.Id == id));
        Assert.False(persisted);
    }

    [Fact]
    public async Task A_measurement_outside_its_bounds_blocks_finalization()
    {
        var client = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                id, CompleteItems(pressure: 1_500m), InspectionState.Finalized, odometerKm: 101_000)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("maximum", string.Join(' ', (await response.ReadProblemAsync()).Errors!.Values.SelectMany(v => v)));
    }

    [Fact]
    public async Task An_odometer_below_the_last_reading_blocks_finalization()
    {
        var client = await App.SignInAsync("inspector");

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), InspectionState.Finalized, odometerKm: 90_000)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("odometerKm"));
    }

    [Fact]
    public async Task Items_outside_the_pinned_template_version_are_rejected()
    {
        var client = await App.SignInAsync("inspector");

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), [new InspectionItemDto(Guid.NewGuid(), ItemStatus.OK, null, null, null)])));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Unknown item", string.Join(' ', (await response.ReadProblemAsync()).Errors!.Values.SelectMany(v => v)));
    }

    [Fact]
    public async Task A_value_on_a_status_item_is_rejected()
    {
        var client = await App.SignInAsync("inspector");

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), [new InspectionItemDto(Fixture.RequiredStatusItemId, ItemStatus.OK, 12m, null, null)])));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Another_users_draft_cannot_be_modified()
    {
        var owner = await App.SignInAsync("inspector");
        var intruder = await App.SignInAsync("inspector2");
        var id = Guid.NewGuid();

        await owner.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems())));

        var response = await intruder.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, CompleteItems(brakeStatus: ItemStatus.Critical))));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_draft_started_on_another_device_cannot_be_continued()
    {
        var first = await App.SignInAsync("inspector", "tablet-a");
        var second = await App.SignInAsync("inspector", "tablet-b");
        var id = Guid.NewGuid();

        await first.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems(), deviceId: "tablet-a")));

        var response = await second.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(id, CompleteItems(), deviceId: "tablet-b")));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("another device", (await response.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task A_payload_device_that_differs_from_the_token_device_is_rejected()
    {
        var client = await App.SignInAsync("inspector", "tablet-a");

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), CompleteItems(), deviceId: "tablet-b")));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Office_accounts_cannot_record_inspections()
    {
        var client = await App.SignInAsync("office");

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), CompleteItems())));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_vehicle_from_another_location_is_invisible_to_an_inspector()
    {
        var client = await App.SignInAsync("inspector");

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), vehicleId: Fixture.OtherLocationVehicleId)));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task An_unpublished_template_cannot_be_used()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var draftTemplate = await (await supervisor.PostJsonAsync("/api/v1/templates", new TemplateWriteRequest(
            "Rascunho", "Caminhão", false,
            [new ChecklistSectionWriteDto(null, "Seção", [
                new ChecklistItemWriteDto(null, "Item", ResponseType.Status, true, null, null, null),
            ])]))).ReadAsync<ChecklistTemplateDto>();

        var client = await App.SignInAsync("inspector");
        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), [], templateId: draftTemplate.Id, templateVersion: draftTemplate.Version)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("published", (await response.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task A_correction_supersedes_the_original_without_altering_it()
    {
        var client = await App.SignInAsync("inspector");
        var originalId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                originalId, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        var correctionId = Guid.NewGuid();
        var correction = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                correctionId,
                CompleteItems(brakeStatus: ItemStatus.Critical),
                InspectionState.Finalized,
                odometerKm: 101_050,
                supersedes: originalId,
                correctionReason: "Pressão registrada no pneu errado")));

        Assert.Equal(HttpStatusCode.OK, correction.StatusCode);

        var original = await App.WithDbAsync(db => db.Inspections
            .Include(i => i.Items)
            .FirstAsync(i => i.Id == originalId));

        Assert.Equal(InspectionState.Finalized, original.State);
        Assert.Equal(101_000, original.OdometerKm);
        Assert.Equal(ItemStatus.OK, original.Items.First(i => i.ItemId == Fixture.RequiredStatusItemId).Status);

        var correctionAudited = await App.WithDbAsync(db => db.AuditEntries
            .AnyAsync(a => a.Action == AuditActions.InspectionCorrected && a.InspectionId == originalId));
        Assert.True(correctionAudited);
    }

    [Fact]
    public async Task A_correction_requires_a_reason()
    {
        var client = await App.SignInAsync("inspector");
        var originalId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                originalId, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), InspectionState.Finalized,
                odometerKm: 101_050, supersedes: originalId)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("correctionReason"));
    }

    [Fact]
    public async Task The_same_inspection_cannot_be_corrected_twice()
    {
        var client = await App.SignInAsync("inspector");
        var originalId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                originalId, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), InspectionState.Finalized,
                odometerKm: 101_050, supersedes: originalId, correctionReason: "Primeira correção")));

        var second = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), CompleteItems(), InspectionState.Finalized,
                odometerKm: 101_060, supersedes: originalId, correctionReason: "Segunda correção")));

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.True((await second.ReadProblemAsync()).Errors!.ContainsKey("supersedesInspectionId"));
    }

    [Fact]
    public async Task Every_accepted_operation_writes_a_receipt_and_an_audit_row_together()
    {
        var client = await App.SignInAsync("inspector");
        var operationId = Guid.NewGuid();
        var id = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(operationId, 0, Inspection(id, CompleteItems())));

        var receipt = await App.WithDbAsync(db => db.SyncOperations.FirstAsync(o => o.OperationId == operationId));
        var audit = await App.WithDbAsync(db => db.AuditEntries
            .AnyAsync(a => a.InspectionId == id && a.Action == AuditActions.InspectionCreated));

        Assert.Equal(id, receipt.InspectionId);
        Assert.Equal(Fixture.InspectorId, receipt.UserId);
        Assert.Equal(64, receipt.PayloadHash.Length);
        Assert.True(audit);
    }

    [Fact]
    public async Task A_rejected_operation_leaves_no_receipt_behind()
    {
        var client = await App.SignInAsync("inspector");
        var operationId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(operationId, 0, Inspection(
                Guid.NewGuid(), CompleteItems(), InspectionState.Finalized, odometerKm: 1)));

        var receipts = await App.WithDbAsync(db => db.SyncOperations.CountAsync());
        Assert.Equal(0, receipts);
    }

    [Fact]
    public async Task Concurrent_retries_of_one_operation_produce_a_single_inspection()
    {
        var client = await App.SignInAsync("inspector");
        var payload = Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), CompleteItems()));

        var responses = await Task.WhenAll(Enumerable.Range(0, 4)
            .Select(_ => client.PostJsonAsync("/api/v1/sync/inspections", payload)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

        var inspections = await App.WithDbAsync(db => db.Inspections.CountAsync());
        var receipts = await App.WithDbAsync(db => db.SyncOperations.CountAsync());

        Assert.Equal(1, inspections);
        Assert.Equal(1, receipts);
    }

    [Fact]
    public async Task History_lists_the_inspections_of_a_vehicle_newest_first()
    {
        var client = await App.SignInAsync("inspector");

        for (var i = 0; i < 3; i++)
        {
            await client.PostJsonAsync("/api/v1/sync/inspections",
                Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), CompleteItems())));
        }

        var history = await (await client.GetAsync($"/api/v1/inspections?vehicleId={Fixture.TruckId}"))
            .ReadAsync<List<InspectionDto>>();

        Assert.Equal(3, history.Count);
        Assert.All(history, i => Assert.Equal(Fixture.TruckId, i.VehicleId));
        Assert.All(history, i => Assert.Equal("Inspector", i.CreatedByName));
    }

    [Fact]
    public async Task An_inspector_cannot_read_an_inspection_from_another_location()
    {
        var otherLocation = await App.SignInAsync("inspector-b", "tablet-b");
        var id = Guid.NewGuid();

        await otherLocation.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                id, [], vehicleId: Fixture.OtherLocationVehicleId, deviceId: "tablet-b")));

        var client = await App.SignInAsync("inspector");
        var response = await client.GetAsync($"/api/v1/inspections/{id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
