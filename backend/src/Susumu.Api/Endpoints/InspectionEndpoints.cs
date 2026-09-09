using Susumu.Api.Security;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class InspectionEndpoints
{
    public static void MapInspectionEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/inspections").WithTags("Inspections");

        group.MapGet("/", async (
                Guid? vehicleId,
                InspectionState? state,
                Guid? supersedesInspectionId,
                int? offset,
                int? limit,
                HttpContext http,
                InspectionQueryService service,
                CancellationToken ct) =>
                Results.Ok(await service.ListAsync(
                    http.CurrentUser(), vehicleId, state, supersedesInspectionId, offset, limit, ct)))
            .WithName("ListInspections")
            .WithSummary("Newest first (startedAt DESC, id DESC); page with offset/limit.");

        group.MapGet("/{id:guid}", async (
                Guid id, HttpContext http, InspectionQueryService service, CancellationToken ct) =>
                Results.Ok(await service.GetAsync(http.CurrentUser(), id, ct)))
            .WithName("GetInspection");

        api.MapPost("/sync/inspections", async (
                SyncInspectionRequest request,
                HttpContext http,
                InspectionSyncService service,
                CancellationToken ct) =>
            {
                var result = await service.ApplyAsync(http.CurrentUser(), http.TokenDeviceId(), request, ct);

                // A replay is reported so the client can tell "already accepted" from "just accepted".
                http.Response.Headers["X-Susumu-Idempotent-Replay"] = result.Replayed ? "true" : "false";
                return Results.Ok(result.Response);
            })
            .RequireAuthorization(SusumuAuthentication.PolicyInspector)
            .WithTags("Inspections")
            .WithName("SyncInspection")
            .WithSummary("Applies one client outbox operation exactly once.");
    }
}
