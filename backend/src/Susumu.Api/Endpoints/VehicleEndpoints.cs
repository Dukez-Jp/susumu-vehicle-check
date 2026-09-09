using Susumu.Api.Security;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class VehicleEndpoints
{
    public static void MapVehicleEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/vehicles").WithTags("Vehicles");

        group.MapGet("/", async (string? search, HttpContext http, VehicleService service, CancellationToken ct) =>
                Results.Ok(await service.ListAsync(http.CurrentUser(), search, ct)))
            .WithName("ListVehicles");

        group.MapGet("/{id:guid}", async (Guid id, HttpContext http, VehicleService service, CancellationToken ct) =>
                Results.Ok(await service.GetAsync(http.CurrentUser(), id, ct)))
            .WithName("GetVehicle");

        group.MapPost("/", async (
                VehicleWriteRequest request, HttpContext http, VehicleService service, CancellationToken ct) =>
            {
                var vehicle = await service.CreateAsync(http.CurrentUser(), request, ct);
                return Results.Created($"/api/v1/vehicles/{vehicle.Id}", vehicle);
            })
            .RequireAuthorization(SusumuAuthentication.PolicyAdministrator)
            .WithName("CreateVehicle");

        group.MapPut("/{id:guid}", async (
                Guid id, VehicleWriteRequest request, HttpContext http, VehicleService service, CancellationToken ct) =>
                Results.Ok(await service.UpdateAsync(http.CurrentUser(), id, request, ct)))
            .RequireAuthorization(SusumuAuthentication.PolicyAdministrator)
            .WithName("UpdateVehicle");
    }
}
