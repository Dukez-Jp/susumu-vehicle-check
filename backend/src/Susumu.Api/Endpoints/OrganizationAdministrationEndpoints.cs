using Susumu.Api.Security;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class OrganizationAdministrationEndpoints
{
    public static void MapOrganizationAdministrationEndpoints(this RouteGroupBuilder api)
    {
        var company = api.MapGroup("/company").WithTags("Company")
            .RequireAuthorization(SusumuAuthentication.PolicyAdministrator);
        company.MapGet("/", async (HttpContext http, OrganizationAdministrationService service, CancellationToken ct) =>
            Results.Ok(await service.GetCompanyAsync(http.CurrentUser(), ct))).WithName("GetCompany");
        company.MapPut("/", async (CompanyWriteRequest request, HttpContext http, OrganizationAdministrationService service, CancellationToken ct) =>
            Results.Ok(await service.UpdateCompanyAsync(http.CurrentUser(), request, ct))).WithName("UpdateCompany");

        var locations = api.MapGroup("/locations").WithTags("Locations")
            .RequireAuthorization(SusumuAuthentication.PolicyAdministrator);
        locations.MapGet("/", async (HttpContext http, OrganizationAdministrationService service, CancellationToken ct) =>
            Results.Ok(await service.ListLocationsAsync(http.CurrentUser(), ct))).WithName("ListLocations");
        locations.MapPost("/", async (CreateLocationRequest request, HttpContext http, OrganizationAdministrationService service, CancellationToken ct) =>
        {
            var location = await service.CreateLocationAsync(http.CurrentUser(), request, ct);
            return Results.Created($"/api/v1/locations/{location.Id}", location);
        }).WithName("CreateLocation");
        locations.MapPut("/{id:guid}", async (Guid id, UpdateLocationRequest request, HttpContext http, OrganizationAdministrationService service, CancellationToken ct) =>
            Results.Ok(await service.UpdateLocationAsync(http.CurrentUser(), id, request, ct))).WithName("UpdateLocation");

        var employees = api.MapGroup("/employees").WithTags("Employees")
            .RequireAuthorization(SusumuAuthentication.PolicyAdministrator);
        employees.MapGet("/", async (HttpContext http, OrganizationAdministrationService service, CancellationToken ct) =>
            Results.Ok(await service.ListEmployeesAsync(http.CurrentUser(), ct))).WithName("ListEmployees");
        employees.MapPost("/", async (EmployeeWriteRequest request, HttpContext http, OrganizationAdministrationService service, CancellationToken ct) =>
        {
            var employee = await service.CreateEmployeeAsync(http.CurrentUser(), request, ct);
            return Results.Created($"/api/v1/employees/{employee.Id}", employee);
        }).WithName("CreateEmployee");
        employees.MapPut("/{id:guid}", async (Guid id, EmployeeWriteRequest request, HttpContext http, OrganizationAdministrationService service, CancellationToken ct) =>
            Results.Ok(await service.UpdateEmployeeAsync(http.CurrentUser(), id, request, ct))).WithName("UpdateEmployee");
    }
}
