using Susumu.Api.Security;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/users")
            .WithTags("Users")
            .RequireAuthorization(SusumuAuthentication.PolicyAdministrator);

        group.MapGet("/", async (HttpContext http, UserAdminService service, CancellationToken ct) =>
                Results.Ok(await service.ListAsync(http.CurrentUser(), ct)))
            .WithName("ListUsers");

        group.MapPost("/", async (
                CreateUserRequest request, HttpContext http, UserAdminService service, CancellationToken ct) =>
            {
                var user = await service.CreateAsync(http.CurrentUser(), request, ct);
                return Results.Created($"/api/v1/users/{user.Id}", user);
            })
            .WithName("CreateUser");

        group.MapPut("/{id:guid}", async (
                Guid id, UpdateUserRequest request, HttpContext http, UserAdminService service, CancellationToken ct) =>
                Results.Ok(await service.UpdateAsync(http.CurrentUser(), id, request, ct)))
            .WithName("UpdateUser");
    }
}
