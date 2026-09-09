using System.Text;
using Susumu.Api.Security;
using Susumu.Domain;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class ReportingEndpoints
{
    public static void MapReportingEndpoints(this RouteGroupBuilder api)
    {
        api.MapGet("/dashboard", async (HttpContext http, ReportingService service, CancellationToken ct) =>
                Results.Ok(await service.DashboardAsync(http.CurrentUser(), ct)))
            .WithTags("Reporting")
            .WithName("GetDashboard");

        api.MapGet("/audit", async (
                Guid? inspectionId, int? offset, int? limit,
                HttpContext http, ReportingService service, CancellationToken ct) =>
                Results.Ok(await service.AuditAsync(http.CurrentUser(), inspectionId, offset, limit, ct)))
            .RequireAuthorization(SusumuAuthentication.PolicyReviewer)
            .WithTags("Reporting")
            .WithName("GetAudit");

        api.MapGet("/exports/inspections.csv", async (
                Guid? vehicleId, InspectionState? state, HttpContext http, ReportingService service, CancellationToken ct) =>
            {
                var csv = await service.InspectionsCsvAsync(http.CurrentUser(), vehicleId, state, ct);

                // UTF-8 BOM so Excel on a Japanese Windows install reads the accented labels correctly.
                var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();
                return Results.File(bytes, "text/csv; charset=utf-8", "inspections.csv");
            })
            .WithTags("Reporting")
            .WithName("ExportInspectionsCsv");
    }
}
