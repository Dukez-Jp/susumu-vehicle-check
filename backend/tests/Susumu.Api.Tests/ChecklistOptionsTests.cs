using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Tests;

/// <summary>
/// Configurable answer options on checklist items: what a template may declare, what survives a
/// round trip to the clients, and what a finalization is allowed to answer. The options belong to
/// the exact template version, so a second version never rewrites the first one's rules.
/// </summary>
public sealed class ChecklistOptionsTests : ApiTestBase
{
    private const string VehicleType = "Caminhão";

    private static TemplateWriteRequest Request(
        IReadOnlyList<ItemStatus>? statusOptions = null,
        IReadOnlyList<ItemStatus>? measurementOptions = null,
        bool requiredStatusItem = true,
        string name = "Check-in com opções")
        => new(name, VehicleType, false,
        [
            new ChecklistSectionWriteDto(null, "Pneus e freios",
            [
                new ChecklistItemWriteDto(
                    null, "Freio de mão", ResponseType.Status, requiredStatusItem, null, null, null, statusOptions),
                new ChecklistItemWriteDto(
                    null, "Pressão dianteira", ResponseType.Measurement, true, "kPa", 400m, 900m, measurementOptions),
            ]),
        ]);

    private static IReadOnlyList<ChecklistItemDto> ItemsOf(ChecklistTemplateDto template)
        => template.Sections.SelectMany(s => s.Items).ToList();

    private async Task<ChecklistTemplateDto> PublishAsync(HttpClient supervisor, TemplateWriteRequest request)
    {
        var created = await (await supervisor.PostJsonAsync("/api/v1/templates", request))
            .ReadAsync<ChecklistTemplateDto>();

        return await (await supervisor.PostJsonAsync($"/api/v1/templates/{created.Id}/publish", new { }))
            .ReadAsync<ChecklistTemplateDto>();
    }

    private static InspectionItemDto Answer(ChecklistItemDto item, ItemStatus status, decimal? value = null)
        => new(item.Id, status, value, null, null);

    [Fact]
    public async Task An_item_without_configured_options_stays_null_and_still_accepts_every_standard_status()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var template = await PublishAsync(supervisor, Request());

        Assert.All(ItemsOf(template), item => Assert.Null(item.AllowedStatuses));

        // The stored row keeps NULL: nothing is backfilled into an explicit list that no one chose.
        var stored = await App.WithDbAsync(db => db.ChecklistItems.AsNoTracking()
            .Where(i => i.Section!.TemplateId == template.Id)
            .Select(i => i.AllowedStatuses)
            .ToListAsync());
        Assert.All(stored, options => Assert.Null(options));

        var read = await (await supervisor.GetAsync($"/api/v1/templates/{template.Id}"))
            .ReadAsync<ChecklistTemplateDto>();
        Assert.All(ItemsOf(read), item => Assert.Null(item.AllowedStatuses));

        // Critical is not in any configured list here; without options every standard status is offered.
        var items = ItemsOf(template);
        var inspector = await App.SignInAsync("inspector");
        var response = await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
            Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(),
                [Answer(items[0], ItemStatus.Critical), Answer(items[1], ItemStatus.Attention, 620m)],
                InspectionState.Finalized,
                templateId: template.Id,
                templateVersion: template.Version)));

        var result = await response.ReadAsync<SyncInspectionResponse>();
        Assert.Equal(InspectionState.Finalized, result.State);
    }

    [Fact]
    public async Task Configured_options_round_trip_verbatim_through_create_get_and_bootstrap()
    {
        var supervisor = await App.SignInAsync("supervisor");

        // Deliberately not in enum order: the exact submitted order is what the clients must render.
        IReadOnlyList<ItemStatus> statusOptions = [ItemStatus.Critical, ItemStatus.OK, ItemStatus.NotApplicable];
        IReadOnlyList<ItemStatus> measurementOptions = [ItemStatus.OK, ItemStatus.Repair];

        var created = await (await supervisor.PostJsonAsync("/api/v1/templates", Request(statusOptions, measurementOptions)))
            .ReadAsync<ChecklistTemplateDto>();

        Assert.Equal(statusOptions, ItemsOf(created)[0].AllowedStatuses);
        Assert.Equal(measurementOptions, ItemsOf(created)[1].AllowedStatuses);

        var published = await (await supervisor.PostJsonAsync($"/api/v1/templates/{created.Id}/publish", new { }))
            .ReadAsync<ChecklistTemplateDto>();
        Assert.Equal(statusOptions, ItemsOf(published)[0].AllowedStatuses);

        var read = await (await supervisor.GetAsync($"/api/v1/templates/{created.Id}"))
            .ReadAsync<ChecklistTemplateDto>();
        Assert.Equal(statusOptions, ItemsOf(read)[0].AllowedStatuses);
        Assert.Equal(measurementOptions, ItemsOf(read)[1].AllowedStatuses);

        // The offline cache is filled from bootstrap, so the options have to survive that path too.
        var inspector = await App.SignInAsync("inspector");
        var bootstrap = await (await inspector.GetAsync("/api/v1/bootstrap")).ReadAsync<BootstrapResponse>();
        var cached = bootstrap.Templates.Single(t => t.Id == created.Id);
        Assert.Equal(statusOptions, ItemsOf(cached)[0].AllowedStatuses);
        Assert.Equal(measurementOptions, ItemsOf(cached)[1].AllowedStatuses);

        // The template seeded before this feature existed is still reported as unrestricted.
        var legacy = bootstrap.Templates.Single(t => t.Id == Fixture.TemplateId);
        Assert.All(ItemsOf(legacy), item => Assert.Null(item.AllowedStatuses));
    }

    [Fact]
    public async Task An_empty_option_list_is_rejected()
    {
        var supervisor = await App.SignInAsync("supervisor");

        var response = await supervisor.PostJsonAsync("/api/v1/templates", Request(statusOptions: []));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Contains("at least one option", problem.Errors!["sections[0].items[0].allowedStatuses"].Single());
        Assert.Equal(1, await App.WithDbAsync(db => db.ChecklistTemplates.CountAsync()));
    }

    [Fact]
    public async Task A_repeated_option_is_rejected()
    {
        var supervisor = await App.SignInAsync("supervisor");

        var response = await supervisor.PostJsonAsync(
            "/api/v1/templates", Request(statusOptions: [ItemStatus.OK, ItemStatus.Repair, ItemStatus.OK]));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Contains("twice", problem.Errors!["sections[0].items[0].allowedStatuses"].Single());
    }

    [Fact]
    public async Task An_option_outside_the_standard_classification_is_rejected()
    {
        var supervisor = await App.SignInAsync("supervisor");

        // Raw JSON: a value the enum does not define cannot be expressed through the typed DTO, and
        // an arbitrary label would destroy the reporting semantics of the classification.
        const string body = """
        {
          "name": "Check-in com opções",
          "vehicleType": "Caminhão",
          "requiresSignature": false,
          "sections": [{
            "title": "Pneus e freios",
            "items": [{
              "label": "Freio de mão",
              "responseType": "status",
              "required": true,
              "allowedStatuses": ["OK", "Amarelo"]
            }]
          }]
        }
        """;

        var response = await supervisor.PostAsync(
            "/api/v1/templates", new StringContent(body, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(1, await App.WithDbAsync(db => db.ChecklistTemplates.CountAsync()));
    }

    [Fact]
    public async Task A_required_item_cannot_offer_only_NotApplicable()
    {
        var supervisor = await App.SignInAsync("supervisor");

        var rejected = await supervisor.PostJsonAsync(
            "/api/v1/templates", Request(statusOptions: [ItemStatus.NotApplicable]));

        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        var problem = await rejected.ReadProblemAsync();
        Assert.Contains("NotApplicable", problem.Errors!["sections[0].items[0].allowedStatuses"].Single());

        // The same option list is legitimate on an item that is not required.
        var accepted = await (await supervisor.PostJsonAsync(
                "/api/v1/templates", Request(statusOptions: [ItemStatus.NotApplicable], requiredStatusItem: false)))
            .ReadAsync<ChecklistTemplateDto>();
        Assert.Equal<ItemStatus[]>([ItemStatus.NotApplicable], [.. ItemsOf(accepted)[0].AllowedStatuses!]);
    }

    [Fact]
    public async Task Finalizing_with_an_option_the_item_does_not_offer_is_rejected_and_leaves_the_operation_reusable()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var template = await PublishAsync(supervisor, Request(statusOptions: [ItemStatus.OK, ItemStatus.Repair]));
        var items = ItemsOf(template);

        var inspector = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var operationId = Guid.NewGuid();

        var rejected = await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
            operationId, 0, Inspection(
                inspectionId,
                [Answer(items[0], ItemStatus.Critical), Answer(items[1], ItemStatus.OK, 620m)],
                InspectionState.Finalized,
                templateId: template.Id,
                templateVersion: template.Version)));

        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        var problem = await rejected.ReadProblemAsync();
        var message = problem.Errors![$"items.{items[0].Id}.status"].Single();
        Assert.Contains("'Critical' is not an allowed option", message);
        Assert.Contains("OK, Repair", message);

        // Nothing was written and the operation id was not consumed, so the corrected answer can be
        // resent as the same operation instead of being blocked as a duplicate.
        Assert.Equal(0, await App.WithDbAsync(db => db.Inspections.CountAsync()));
        Assert.Equal(0, await App.WithDbAsync(db => db.SyncOperations.CountAsync()));

        var accepted = await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
            operationId, 0, Inspection(
                inspectionId,
                [Answer(items[0], ItemStatus.Repair), Answer(items[1], ItemStatus.OK, 620m)],
                InspectionState.Finalized,
                templateId: template.Id,
                templateVersion: template.Version)));

        Assert.Equal(InspectionState.Finalized, (await accepted.ReadAsync<SyncInspectionResponse>()).State);
    }

    [Fact]
    public async Task A_draft_keeps_the_NotApplicable_placeholder_that_finalization_would_refuse()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var template = await PublishAsync(supervisor, Request(
            statusOptions: [ItemStatus.OK, ItemStatus.Repair],
            measurementOptions: [ItemStatus.OK, ItemStatus.Attention]));
        var items = ItemsOf(template);

        var inspector = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();

        // What a tablet autosaves before anything has been answered. Losing it would cost field work.
        var placeholders = new List<InspectionItemDto>
        {
            Answer(items[0], ItemStatus.NotApplicable),
            Answer(items[1], ItemStatus.NotApplicable),
        };

        var draft = await (await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
                Guid.NewGuid(), 0, Inspection(
                    inspectionId, placeholders, templateId: template.Id, templateVersion: template.Version))))
            .ReadAsync<SyncInspectionResponse>();

        Assert.Equal(InspectionState.Draft, draft.State);
        Assert.Equal(1, draft.Version);

        var stored = await App.WithDbAsync(db => db.InspectionItems.AsNoTracking()
            .Where(i => i.InspectionId == inspectionId).Select(i => i.Status).ToListAsync());
        Assert.All(stored, status => Assert.Equal(ItemStatus.NotApplicable, status));

        var finalizeWithPlaceholder = await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
            Guid.NewGuid(), 1, Inspection(
                inspectionId, placeholders, InspectionState.Finalized,
                templateId: template.Id, templateVersion: template.Version)));

        Assert.Equal(HttpStatusCode.BadRequest, finalizeWithPlaceholder.StatusCode);
        var problem = await finalizeWithPlaceholder.ReadProblemAsync();
        Assert.Contains($"items.{items[0].Id}.status", problem.Errors!.Keys);
        Assert.Contains($"items.{items[1].Id}.status", problem.Errors!.Keys);

        // The draft is untouched by the refused finalization and still finalizes once answered.
        var finalized = await (await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
                Guid.NewGuid(), 1, Inspection(
                    inspectionId,
                    [Answer(items[0], ItemStatus.Repair), Answer(items[1], ItemStatus.Attention, 620m)],
                    InspectionState.Finalized,
                    templateId: template.Id,
                    templateVersion: template.Version))))
            .ReadAsync<SyncInspectionResponse>();

        Assert.Equal(InspectionState.Finalized, finalized.State);
    }

    [Fact]
    public async Task Each_template_version_is_validated_against_the_options_it_was_published_with()
    {
        var supervisor = await App.SignInAsync("supervisor");

        const string family = "Check-in versionado";
        var v1 = await PublishAsync(supervisor, Request(statusOptions: [ItemStatus.OK, ItemStatus.Repair], name: family));
        var v2 = await PublishAsync(supervisor, Request(statusOptions: [ItemStatus.OK, ItemStatus.Attention], name: family));

        Assert.Equal(1, v1.Version);
        Assert.Equal(2, v2.Version);

        var firstItems = ItemsOf(v1);
        var secondItems = ItemsOf(v2);
        var inspector = await App.SignInAsync("inspector");

        // Repair belongs to v1 only; the newer version must not widen or narrow the pinned rules.
        var onVersionOne = await (await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
                Guid.NewGuid(), 0, Inspection(
                    Guid.NewGuid(),
                    [Answer(firstItems[0], ItemStatus.Repair), Answer(firstItems[1], ItemStatus.OK, 620m)],
                    InspectionState.Finalized,
                    templateId: v1.Id,
                    templateVersion: v1.Version))))
            .ReadAsync<SyncInspectionResponse>();
        Assert.Equal(InspectionState.Finalized, onVersionOne.State);

        var repairOnVersionTwo = await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
            Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(),
                [Answer(secondItems[0], ItemStatus.Repair), Answer(secondItems[1], ItemStatus.OK, 620m)],
                InspectionState.Finalized,
                templateId: v2.Id,
                templateVersion: v2.Version)));
        Assert.Equal(HttpStatusCode.BadRequest, repairOnVersionTwo.StatusCode);

        var attentionOnVersionOne = await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
            Guid.NewGuid(), 0, Inspection(
                Guid.NewGuid(),
                [Answer(firstItems[0], ItemStatus.Attention), Answer(firstItems[1], ItemStatus.OK, 620m)],
                InspectionState.Finalized,
                templateId: v1.Id,
                templateVersion: v1.Version)));
        Assert.Equal(HttpStatusCode.BadRequest, attentionOnVersionOne.StatusCode);

        var attentionOnVersionTwo = await (await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
                Guid.NewGuid(), 0, Inspection(
                    Guid.NewGuid(),
                    [Answer(secondItems[0], ItemStatus.Attention), Answer(secondItems[1], ItemStatus.OK, 620m)],
                    InspectionState.Finalized,
                    templateId: v2.Id,
                    templateVersion: v2.Version))))
            .ReadAsync<SyncInspectionResponse>();
        Assert.Equal(InspectionState.Finalized, attentionOnVersionTwo.State);
    }

    /// <summary>
    /// Template creation resolves the vehicle type through the catalog, inside the same company write
    /// transaction, so a retired type stops accepting new versions without touching what already
    /// exists. Retirement is availability, never history.
    /// </summary>
    [Fact]
    public async Task A_new_version_needs_an_active_catalog_type_while_published_ones_stay_readable()
    {
        var supervisor = await App.SignInAsync("supervisor");
        var published = await PublishAsync(supervisor, Request(statusOptions: [ItemStatus.OK, ItemStatus.Repair]));

        var admin = await App.SignInAsync("admin");
        var types = await (await admin.GetAsync("/api/v1/vehicle-types")).ReadAsync<List<VehicleTypeDto>>();
        var truck = types.Single(t => t.Code == VehicleType);
        await (await admin.PutJsonAsync($"/api/v1/vehicle-types/{truck.Id}", new UpdateVehicleTypeRequest(truck.Name, false)))
            .ReadAsync<VehicleTypeDto>();

        var rejected = await supervisor.PostJsonAsync("/api/v1/templates", Request(name: "Check-in de tipo aposentado"));
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.False(await App.WithDbAsync(db => db.ChecklistTemplates.AnyAsync(t => t.Name == "Check-in de tipo aposentado")));

        // The version published before the retirement keeps its definition, its options and its use.
        var read = await (await supervisor.GetAsync($"/api/v1/templates/{published.Id}"))
            .ReadAsync<ChecklistTemplateDto>();
        Assert.Equal<ItemStatus[]>([ItemStatus.OK, ItemStatus.Repair], [.. ItemsOf(read)[0].AllowedStatuses!]);

        var items = ItemsOf(published);
        var inspector = await App.SignInAsync("inspector");
        var finalized = await (await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(
                Guid.NewGuid(), 0, Inspection(
                    Guid.NewGuid(),
                    [Answer(items[0], ItemStatus.Repair), Answer(items[1], ItemStatus.OK, 620m)],
                    InspectionState.Finalized,
                    templateId: published.Id,
                    templateVersion: published.Version))))
            .ReadAsync<SyncInspectionResponse>();

        Assert.Equal(InspectionState.Finalized, finalized.State);
    }

    /// <summary>
    /// The HTTP pipeline already rejects a revoked account, so this exercises the second check: the
    /// actor is re-read after the company write lock is held, which is the only point where a role
    /// change that landed while the request was queued can still be seen.
    /// </summary>
    [Fact]
    public async Task A_role_revoked_while_the_request_waited_for_the_company_lock_cannot_create_a_version()
    {
        var actor = new CurrentUser(
            Fixture.SupervisorId, Fixture.CompanyId, Fixture.LocationId, UserRole.Supervisor, "Supervisor", "supervisor");

        await App.WithDbAsync(async db =>
        {
            var user = await db.Users.SingleAsync(u => u.Id == Fixture.SupervisorId);
            user.Role = UserRole.Inspector;
            await db.SaveChangesAsync();
        });

        using var scope = App.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<TemplateService>();

        var error = await Assert.ThrowsAsync<AppException>(
            () => service.CreateVersionAsync(actor, Request(), CancellationToken.None));

        Assert.Equal((int)HttpStatusCode.Forbidden, error.Status);
        Assert.Equal(1, await App.WithDbAsync(db => db.ChecklistTemplates.CountAsync()));
    }
}
