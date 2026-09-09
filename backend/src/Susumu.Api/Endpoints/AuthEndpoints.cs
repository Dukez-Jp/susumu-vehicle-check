using Susumu.Api.Security;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/auth").WithTags("Auth");

        group.MapPost("/login", async (
                LoginRequest request, HttpContext http, AuthService service, CancellationToken ct) =>
            {
                var response = await service.LoginAsync(request, http.ClientKey(), ct);
                return Results.Ok(response);
            })
            .AllowAnonymous()
            .WithName("Login")
            .WithSummary("Signs in and returns an access token plus the offline draft window.");

        group.MapGet("/me", (HttpContext http) =>
            {
                var actor = http.CurrentUser();
                return Results.Ok(new UserDto(
                    actor.Id, actor.Name, actor.Username, actor.Role, actor.CompanyId, actor.LocationId, true));
            })
            .WithName("GetCurrentUser");

        api.MapGet("/bootstrap", async (HttpContext http, AuthService service, CancellationToken ct) =>
                Results.Ok(await service.BootstrapAsync(http.CurrentUser(), ct)))
            .WithTags("Auth")
            .WithName("Bootstrap")
            .WithSummary("Everything a tablet needs cached before going offline.");
    }
}
