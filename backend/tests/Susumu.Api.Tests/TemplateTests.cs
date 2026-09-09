using System.Net;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;

namespace Susumu.Api.Tests;

public sealed class TemplateTests : ApiTestBase
{
    private static TemplateWriteRequest Request(string name = "Check-in diário de caminhão", bool signature = false)
        => new(name, "Caminhão", signature,
        [
            new ChecklistSectionWriteDto(null, "Pneus", [
                new ChecklistItemWriteDto(null, "Pressão dianteira", ResponseType.Measurement, true, "kPa", 400m, 900m),
                new ChecklistItemWriteDto(null, "Freio de mão", ResponseType.Status, true, null, null, null),
            ]),
        ]);

    [Fact]
    public async Task A_new_version_starts_unpublished_and_increments_the_family_version()
    {
        var client = await App.SignInAsync("supervisor");

        var created = await (await client.PostJsonAsync("/api/v1/templates", Request()))
            .ReadAsync<ChecklistTemplateDto>();

        Assert.False(created.Published);
        Assert.Equal(2, created.Version);
        Assert.NotEqual(Fixture.TemplateId, created.Id);
        Assert.All(created.Sections.SelectMany(s => s.Items), item => Assert.NotEqual(Guid.Empty, item.Id));
    }

    [Fact]
    public async Task Publishing_freezes_the_version_and_cannot_be_repeated()
    {
        var client = await App.SignInAsync("supervisor");
        var created = await (await client.PostJsonAsync("/api/v1/templates", Request()))
            .ReadAsync<ChecklistTemplateDto>();

        var published = await (await client.PostJsonAsync($"/api/v1/templates/{created.Id}/publish", new { }))
            .ReadAsync<ChecklistTemplateDto>();
        Assert.True(published.Published);

        var again = await client.PostJsonAsync($"/api/v1/templates/{created.Id}/publish", new { });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Contains("already published", (await again.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task An_inspector_cannot_create_or_publish_templates()
    {
        var client = await App.SignInAsync("inspector");

        var create = await client.PostJsonAsync("/api/v1/templates", Request());
        var publish = await client.PostJsonAsync($"/api/v1/templates/{Fixture.TemplateId}/publish", new { });

        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, publish.StatusCode);
    }

    [Fact]
    public async Task An_inspector_only_sees_published_versions()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var draft = await (await supervisor.PostJsonAsync("/api/v1/templates", Request()))
            .ReadAsync<ChecklistTemplateDto>();

        var inspector = await App.SignInAsync("inspector");
        var visible = await (await inspector.GetAsync("/api/v1/templates")).ReadAsync<List<ChecklistTemplateDto>>();

        Assert.DoesNotContain(visible, t => t.Id == draft.Id);
        Assert.All(visible, t => Assert.True(t.Published));

        var direct = await inspector.GetAsync($"/api/v1/templates/{draft.Id}");
        Assert.Equal(HttpStatusCode.NotFound, direct.StatusCode);
    }

    [Fact]
    public async Task A_template_without_sections_or_items_is_rejected()
    {
        var client = await App.SignInAsync("supervisor");

        var noSections = await client.PostJsonAsync("/api/v1/templates",
            new TemplateWriteRequest("Vazio", "Caminhão", false, []));
        var noItems = await client.PostJsonAsync("/api/v1/templates",
            new TemplateWriteRequest("Vazio", "Caminhão", false,
                [new ChecklistSectionWriteDto(null, "Seção", [])]));

        Assert.Equal(HttpStatusCode.BadRequest, noSections.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, noItems.StatusCode);
    }

    [Fact]
    public async Task Inverted_measurement_bounds_are_rejected()
    {
        var client = await App.SignInAsync("supervisor");

        var response = await client.PostJsonAsync("/api/v1/templates", new TemplateWriteRequest(
            "Limites", "Caminhão", false,
            [new ChecklistSectionWriteDto(null, "Seção", [
                new ChecklistItemWriteDto(null, "Pressão", ResponseType.Measurement, true, "kPa", 900m, 400m),
            ])]));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains((await response.ReadProblemAsync()).Errors!.Keys, k => k.EndsWith("minValue"));
    }

    [Fact]
    public async Task A_signature_template_blocks_finalization_until_a_signature_exists()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var created = await (await supervisor.PostJsonAsync("/api/v1/templates", Request("Com assinatura", signature: true)))
            .ReadAsync<ChecklistTemplateDto>();
        await supervisor.PostJsonAsync($"/api/v1/templates/{created.Id}/publish", new { });

        var items = created.Sections.SelectMany(s => s.Items).ToList();
        var payload = Inspection(
            Guid.NewGuid(),
            [
                new InspectionItemDto(items[0].Id, ItemStatus.OK, 620m, null, null),
                new InspectionItemDto(items[1].Id, ItemStatus.OK, null, null, null),
            ],
            InspectionState.Finalized,
            odometerKm: 101_000,
            templateId: created.Id,
            templateVersion: created.Version);

        var inspector = await App.SignInAsync("inspector");
        var response = await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, payload));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("signaturePhotoId"));
    }

    [Fact]
    public async Task Publishing_a_new_version_leaves_earlier_inspections_pinned_to_the_old_one()
    {
        var inspector = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(inspectionId, CompleteItems())));

        var supervisor = await App.SignInAsync("supervisor");
        var created = await (await supervisor.PostJsonAsync("/api/v1/templates", Request()))
            .ReadAsync<ChecklistTemplateDto>();
        await supervisor.PostJsonAsync($"/api/v1/templates/{created.Id}/publish", new { });

        var stored = await (await inspector.GetAsync($"/api/v1/inspections/{inspectionId}"))
            .ReadAsync<InspectionDto>();

        Assert.Equal(Fixture.TemplateId, stored.TemplateId);
        Assert.Equal(1, stored.TemplateVersion);
    }

    [Fact]
    public async Task A_template_for_another_vehicle_type_cannot_be_used()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var vanTemplate = await (await supervisor.PostJsonAsync("/api/v1/templates", new TemplateWriteRequest(
            "Check-in de van", "Van", false,
            [new ChecklistSectionWriteDto(null, "Seção", [
                new ChecklistItemWriteDto(null, "Item", ResponseType.Status, true, null, null, null),
            ])]))).ReadAsync<ChecklistTemplateDto>();
        await supervisor.PostJsonAsync($"/api/v1/templates/{vanTemplate.Id}/publish", new { });

        var inspector = await App.SignInAsync("inspector");
        var response = await inspector.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(), [], templateId: vanTemplate.Id, templateVersion: vanTemplate.Version)));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("vehicle type", (await response.ReadProblemAsync()).Detail);
    }
}
