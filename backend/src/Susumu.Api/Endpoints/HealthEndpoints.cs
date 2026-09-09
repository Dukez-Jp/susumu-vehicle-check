using Microsoft.EntityFrameworkCore;
using Susumu.Infrastructure.Persistence;

namespace Susumu.Api.Endpoints;

public static class HealthEndpoints
{
    /// <summary>
    /// Unauthenticated probes. They expose no configuration, no versions and no connection strings:
    /// readiness answers only whether the database is reachable.
    /// </summary>
    public static void MapHealthEndpoints(this IEndpointRouteBuilder app, string prefix)
    {
        var group = app.MapGroup(prefix).WithTags("Health").AllowAnonymous();

        group.MapGet("/live", () => Results.Ok(new { status = "live" }));

        group.MapGet("/ready", async (SusumuDbContext db, CancellationToken ct) =>
        {
            var reachable = await db.Database.CanConnectAsync(ct);
            return reachable
                ? Results.Ok(new { status = "ready" })
                : Results.Json(new { status = "unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
        });
    }
}
