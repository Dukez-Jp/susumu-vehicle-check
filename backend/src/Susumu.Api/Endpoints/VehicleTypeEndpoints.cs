using Susumu.Api.Security;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class VehicleTypeEndpoints
{
    public static void MapVehicleTypeEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/vehicle-types").WithTags("Vehicle types").RequireAuthorization();
        group.MapGet("/", async (HttpContext http, VehicleTypeService service, CancellationToken ct) =>
            Results.Ok(await service.ListAsync(http.CurrentUser(), ct))).WithName("ListVehicleTypes");
        group.MapPost("/", async (CreateVehicleTypeRequest request, HttpContext http, VehicleTypeService service, CancellationToken ct) =>
        {
            var type = await service.CreateAsync(http.CurrentUser(), request, ct);
            return Results.Created($"/api/v1/vehicle-types/{type.Id}", type);
        }).RequireAuthorization(SusumuAuthentication.PolicyAdministrator).WithName("CreateVehicleType");
        group.MapPut("/{id:guid}", async (Guid id, UpdateVehicleTypeRequest request, HttpContext http, VehicleTypeService service, CancellationToken ct) =>
            Results.Ok(await service.UpdateAsync(http.CurrentUser(), id, request, ct)))
            .RequireAuthorization(SusumuAuthentication.PolicyAdministrator).WithName("UpdateVehicleType");
    }
}
