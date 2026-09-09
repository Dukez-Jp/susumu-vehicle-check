using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure;

namespace Susumu.Api.Tests;

/// <summary>
/// Contract completion clarifications: template availability separated from publication, and a
/// signature declared by id so a tablet can finalize before the bytes ever leave the device.
/// </summary>
public sealed class TemplateAvailabilityTests : ApiTestBase
{
    [Fact]
    public async Task Retiring_a_version_removes_it_from_bootstrap_but_not_from_the_catalogue()
    {
        var supervisor = await App.SignInAsync("supervisor");

        var retired = await (await supervisor.PostJsonAsync(
            $"/api/v1/templates/{Fixture.TemplateId}/retire", new { })).ReadAsync<ChecklistTemplateDto>();

        Assert.False(retired.Active);
        Assert.True(retired.Published);
        Assert.NotEmpty(retired.Sections);

        var inspector = await App.SignInAsync("inspector");
        var bootstrap = await (await inspector.GetAsync("/api/v1/bootstrap")).ReadAsync<BootstrapResponse>();
        Assert.DoesNotContain(bootstrap.Templates, t => t.Id == Fixture.TemplateId);

        var catalogue = await (await inspector.GetAsync("/api/v1/templates")).ReadAsync<List<ChecklistTemplateDto>>();
        Assert.Contains(catalogue, t => t.Id == Fixture.TemplateId);
    }

    [Fact]
    public async Task Work_already_pinned_to_a_retired_version_still_syncs_and_finalizes()
    {
        var inspector = await App.SignInAsync("inspector");
        var id = Guid.NewGuid();

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(id, CompleteItems())));

        var supervisor = await App.SignInAsync("supervisor");
        await supervisor.PostJsonAsync($"/api/v1/templates/{Fixture.TemplateId}/retire", new { });

        var finalize = await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(
                id, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        Assert.Equal(HttpStatusCode.OK, finalize.StatusCode);
        Assert.Equal(InspectionState.Finalized, (await finalize.ReadAsync<SyncInspectionResponse>()).State);

        // A brand new inspection on the retired version is still accepted: the version is published.
        var fresh = await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), CompleteItems())));
        Assert.Equal(HttpStatusCode.OK, fresh.StatusCode);
    }

    [Fact]
    public async Task Retirement_and_activation_are_audited_and_reversible()
    {
        var supervisor = await App.SignInAsync("supervisor");

        await supervisor.PostJsonAsync($"/api/v1/templates/{Fixture.TemplateId}/retire", new { });
        var reactivated = await (await supervisor.PostJsonAsync(
            $"/api/v1/templates/{Fixture.TemplateId}/activate", new { })).ReadAsync<ChecklistTemplateDto>();

        Assert.True(reactivated.Active);

        var actions = await App.WithDbAsync(db => db.AuditEntries
            .Where(a => a.EntityId == Fixture.TemplateId)
            .Select(a => a.Action)
            .ToListAsync());

        Assert.Contains(AuditActions.TemplateRetired, actions);
        Assert.Contains(AuditActions.TemplateActivated, actions);
    }

    [Fact]
    public async Task An_inspector_cannot_change_template_availability()
    {
        var inspector = await App.SignInAsync("inspector");

        var response = await inspector.PostJsonAsync($"/api/v1/templates/{Fixture.TemplateId}/retire", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}

public sealed class SignatureTests : ApiTestBase
{
    private async Task<ChecklistTemplateDto> SignatureTemplateAsync()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var created = await (await supervisor.PostJsonAsync("/api/v1/templates", new TemplateWriteRequest(
            "Check-in com assinatura", "Caminhão", true,
            [new ChecklistSectionWriteDto(null, "Conferência", [
                new ChecklistItemWriteDto(null, "Estado geral", ResponseType.Status, true, null, null, null),
            ])]))).ReadAsync<ChecklistTemplateDto>();

        return await (await supervisor.PostJsonAsync($"/api/v1/templates/{created.Id}/publish", new { }))
            .ReadAsync<ChecklistTemplateDto>();
    }

    private InspectionDto SignaturePayload(
        ChecklistTemplateDto template, Guid id, Guid? signaturePhotoId, InspectionState state)
    {
        var itemId = template.Sections[0].Items[0].Id;
        return Inspection(
            id,
            [new InspectionItemDto(itemId, ItemStatus.OK, null, null, null)],
            state,
            odometerKm: 101_000,
            templateId: template.Id,
            templateVersion: template.Version) with
        {
            SignaturePhotoId = signaturePhotoId,
        };
    }

    [Fact]
    public async Task Finalizing_a_signature_template_requires_a_declared_signature_id()
    {
        var template = await SignatureTemplateAsync();
        var inspector = await App.SignInAsync("inspector");

        var response = await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, SignaturePayload(template, Guid.NewGuid(), null, InspectionState.Finalized)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("signaturePhotoId"));
    }

    [Fact]
    public async Task A_declared_signature_finalizes_without_the_bytes_and_stays_pending_until_uploaded()
    {
        var template = await SignatureTemplateAsync();
        var inspector = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var signatureId = Guid.NewGuid();

        var finalize = await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0,
                SignaturePayload(template, inspectionId, signatureId, InspectionState.Finalized)));

        var result = await finalize.ReadAsync<SyncInspectionResponse>();
        Assert.Equal(InspectionState.Finalized, result.State);
        Assert.Equal(PhotoUploadState.Pending, result.PhotoUploadState);

        var placeholder = await App.WithDbAsync(db => db.Photos.FirstAsync(p => p.Id == signatureId));
        Assert.Equal(PhotoKind.Signature, placeholder.Kind);
        Assert.Null(placeholder.ItemId);
        Assert.False(placeholder.Uploaded);

        var (bytes, sha) = TestImages.Png("assinatura");
        var upload = await UploadAsync(inspector, inspectionId, signatureId, bytes, sha, PhotoKind.Signature);
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);

        var stored = await (await inspector.GetAsync($"/api/v1/inspections/{inspectionId}"))
            .ReadAsync<InspectionDto>();
        Assert.Equal(PhotoUploadState.Complete, stored.PhotoUploadState);
        Assert.Equal(signatureId, stored.SignaturePhotoId);
    }

    [Fact]
    public async Task A_signature_id_cannot_be_shared_with_an_item_photo()
    {
        var template = await SignatureTemplateAsync();
        var inspector = await App.SignInAsync("inspector");
        var shared = Guid.NewGuid();
        var itemId = template.Sections[0].Items[0].Id;

        var payload = Inspection(
            Guid.NewGuid(),
            [new InspectionItemDto(itemId, ItemStatus.OK, null, null, [shared])],
            templateId: template.Id,
            templateVersion: template.Version) with
        {
            SignaturePhotoId = shared,
        };

        var response = await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, payload));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("inspection.signaturePhotoId"));
    }

    [Fact]
    public async Task A_signature_cannot_be_uploaded_under_an_undeclared_id_after_finalization()
    {
        var template = await SignatureTemplateAsync();
        var inspector = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var signatureId = Guid.NewGuid();

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0,
                SignaturePayload(template, inspectionId, signatureId, InspectionState.Finalized)));

        var (bytes, sha) = TestImages.Png("assinatura-clandestina");
        var response = await UploadAsync(inspector, inspectionId, Guid.NewGuid(), bytes, sha, PhotoKind.Signature);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_correction_cannot_reuse_the_signature_of_the_inspection_it_corrects()
    {
        var template = await SignatureTemplateAsync();
        var inspector = await App.SignInAsync("inspector");
        var originalId = Guid.NewGuid();
        var signatureId = Guid.NewGuid();

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0,
                SignaturePayload(template, originalId, signatureId, InspectionState.Finalized)));

        var correction = SignaturePayload(template, Guid.NewGuid(), signatureId, InspectionState.Finalized) with
        {
            SupersedesInspectionId = originalId,
            CorrectionReason = "Assinatura do motorista errado",
            OdometerKm = 101_050,
        };

        var response = await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, correction));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("already attached to another inspection", (await response.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task An_item_photo_cannot_be_uploaded_under_the_declared_signature_id()
    {
        var template = await SignatureTemplateAsync();
        var inspector = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var signatureId = Guid.NewGuid();

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, SignaturePayload(template, inspectionId, signatureId, InspectionState.Draft)));

        var (bytes, sha) = TestImages.Png("foto-comum");
        var response = await UploadAsync(inspector, inspectionId, signatureId, bytes, sha, PhotoKind.Original);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Clearing_the_signature_of_a_draft_drops_only_the_unused_placeholder()
    {
        var template = await SignatureTemplateAsync();
        var inspector = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var signatureId = Guid.NewGuid();

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, SignaturePayload(template, inspectionId, signatureId, InspectionState.Draft)));

        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, SignaturePayload(template, inspectionId, null, InspectionState.Draft)));

        Assert.Equal(0, await App.WithDbAsync(db => db.Photos.CountAsync(p => p.Id == signatureId)));
    }

    private static Task<HttpResponseMessage> UploadAsync(
        HttpClient client, Guid inspectionId, Guid photoId, byte[] bytes, string sha, PhotoKind kind)
    {
        var metadata = new PhotoUploadMetadata(
            photoId, null, kind, null, "image/png", sha, bytes.Length, DateTimeOffset.UtcNow);

        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(file, "file", "signature.png");
        content.Add(new StringContent(JsonSerializer.Serialize(metadata, SusumuJson.Options)), "metadata");

        return client.PostAsync($"/api/v1/inspections/{inspectionId}/photos/{photoId}", content);
    }

}

public sealed class PagingTests : ApiTestBase
{
    [Fact]
    public async Task History_pages_with_offset_and_limit_in_a_stable_order()
    {
        var client = await App.SignInAsync("inspector");

        for (var i = 0; i < 5; i++)
        {
            await client.PostJsonAsync("/api/v1/sync/inspections",
                Operation(Guid.NewGuid(), 0, Inspection(Guid.NewGuid(), CompleteItems())));
        }

        var all = await (await client.GetAsync("/api/v1/inspections?limit=5")).ReadAsync<List<InspectionDto>>();
        var firstPage = await (await client.GetAsync("/api/v1/inspections?offset=0&limit=2")).ReadAsync<List<InspectionDto>>();
        var secondPage = await (await client.GetAsync("/api/v1/inspections?offset=2&limit=2")).ReadAsync<List<InspectionDto>>();
        var shortPage = await (await client.GetAsync("/api/v1/inspections?offset=4&limit=2")).ReadAsync<List<InspectionDto>>();

        Assert.Equal(5, all.Count);
        Assert.Equal(all.Take(2).Select(i => i.Id), firstPage.Select(i => i.Id));
        Assert.Equal(all.Skip(2).Take(2).Select(i => i.Id), secondPage.Select(i => i.Id));
        Assert.Single(shortPage);
        Assert.Equal(5, firstPage.Concat(secondPage).Concat(shortPage).Select(i => i.Id).Distinct().Count());
    }

    [Theory]
    [InlineData("offset=-1")]
    [InlineData("limit=0")]
    [InlineData("limit=501")]
    public async Task Out_of_bounds_paging_values_are_rejected(string query)
    {
        var client = await App.SignInAsync("inspector");

        var response = await client.GetAsync($"/api/v1/inspections?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Audit_rejects_a_limit_above_its_own_maximum()
    {
        var supervisor = await App.SignInAsync("supervisor");

        Assert.Equal(HttpStatusCode.BadRequest, (await supervisor.GetAsync("/api/v1/audit?limit=201")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await supervisor.GetAsync("/api/v1/audit?limit=200&offset=0")).StatusCode);
    }

    [Fact]
    public async Task Corrections_of_one_inspection_can_be_listed_explicitly()
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
                odometerKm: 101_010, supersedes: originalId, correctionReason: "Status corrigido")));

        var corrections = await (await client.GetAsync(
            $"/api/v1/inspections?supersedesInspectionId={originalId}")).ReadAsync<List<InspectionDto>>();

        var only = Assert.Single(corrections);
        Assert.Equal(correctionId, only.Id);
        Assert.Equal(originalId, only.SupersedesInspectionId);

        var none = await (await client.GetAsync(
            $"/api/v1/inspections?supersedesInspectionId={Guid.NewGuid()}")).ReadAsync<List<InspectionDto>>();
        Assert.Empty(none);
    }
}
