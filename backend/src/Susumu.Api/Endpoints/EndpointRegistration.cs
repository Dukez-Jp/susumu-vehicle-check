namespace Susumu.Api.Endpoints;

public static class EndpointRegistration
{
    public const string ApiPrefix = "/api/v1";

    public static void MapSusumuEndpoints(this WebApplication app)
    {
        var api = app.MapGroup(ApiPrefix);

        api.MapAuthEndpoints();
        api.MapVehicleEndpoints();
        api.MapVehicleTypeEndpoints();
        api.MapTemplateEndpoints();
        api.MapInspectionEndpoints();
        api.MapPhotoEndpoints();
        api.MapUserEndpoints();
        api.MapOrganizationAdministrationEndpoints();
        api.MapReportingEndpoints();

        // Probes are exposed under the API prefix (contract) and at the root for container health checks.
        api.MapHealthEndpoints("/health");
        app.MapHealthEndpoints("/health");
    }
}
