using Susumu.Api.Security;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class TemplateEndpoints
{
    public static void MapTemplateEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/templates").WithTags("Checklist templates");

        group.MapGet("/", async (HttpContext http, TemplateService service, CancellationToken ct) =>
                Results.Ok(await service.ListAsync(http.CurrentUser(), ct)))
            .WithName("ListTemplates");

        group.MapGet("/{id:guid}", async (Guid id, HttpContext http, TemplateService service, CancellationToken ct) =>
                Results.Ok(await service.GetAsync(http.CurrentUser(), id, ct)))
            .WithName("GetTemplate");

        group.MapPost("/", async (
                TemplateWriteRequest request, HttpContext http, TemplateService service, CancellationToken ct) =>
            {
                var template = await service.CreateVersionAsync(http.CurrentUser(), request, ct);
                return Results.Created($"/api/v1/templates/{template.Id}", template);
            })
            .RequireAuthorization(SusumuAuthentication.PolicyReviewer)
            .WithName("CreateTemplateVersion")
            .WithSummary("Creates a new unpublished version. Published versions are never modified.");

        group.MapPost("/{id:guid}/publish", async (
                Guid id, HttpContext http, TemplateService service, CancellationToken ct) =>
                Results.Ok(await service.PublishAsync(http.CurrentUser(), id, ct)))
            .RequireAuthorization(SusumuAuthentication.PolicyReviewer)
            .WithName("PublishTemplate");

        group.MapPost("/{id:guid}/retire", async (
                Guid id, HttpContext http, TemplateService service, CancellationToken ct) =>
                Results.Ok(await service.SetAvailabilityAsync(http.CurrentUser(), id, active: false, ct)))
            .RequireAuthorization(SusumuAuthentication.PolicyReviewer)
            .WithName("RetireTemplate")
            .WithSummary("Stops offering this version for new work. Existing inspections keep syncing.");

        group.MapPost("/{id:guid}/activate", async (
                Guid id, HttpContext http, TemplateService service, CancellationToken ct) =>
                Results.Ok(await service.SetAvailabilityAsync(http.CurrentUser(), id, active: true, ct)))
            .RequireAuthorization(SusumuAuthentication.PolicyReviewer)
            .WithName("ActivateTemplate");
    }
}
