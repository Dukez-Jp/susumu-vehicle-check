using System.Net;
using Microsoft.EntityFrameworkCore;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Entities;
using Susumu.Domain.Contracts;

namespace Susumu.Api.Tests;

public sealed class VehicleTests : ApiTestBase
{
    [Fact]
    public async Task Search_finds_the_synthetic_truck_by_internal_number()
    {
        var client = await App.SignInAsync("inspector");

        var vehicles = await (await client.GetAsync("/api/v1/vehicles?search=714")).ReadAsync<List<VehicleDto>>();

        Assert.Single(vehicles);
        Assert.Equal("714", vehicles[0].InternalNumber);
        Assert.Equal(Fixture.TruckId, vehicles[0].Id);
    }

    [Fact]
    public async Task Search_also_matches_the_plate_and_the_identifier()
    {
        var client = await App.SignInAsync("inspector");

        var byPlate = await (await client.GetAsync("/api/v1/vehicles?search=TEST-714")).ReadAsync<List<VehicleDto>>();
        var byId = await (await client.GetAsync($"/api/v1/vehicles?search={Fixture.TruckId}")).ReadAsync<List<VehicleDto>>();

        Assert.Equal(Fixture.TruckId, Assert.Single(byPlate).Id);
        Assert.Equal(Fixture.TruckId, Assert.Single(byId).Id);
    }

    [Fact]
    public async Task An_inspector_never_sees_vehicles_from_another_location()
    {
        var client = await App.SignInAsync("inspector");

        var list = await (await client.GetAsync("/api/v1/vehicles")).ReadAsync<List<VehicleDto>>();
        var direct = await client.GetAsync($"/api/v1/vehicles/{Fixture.OtherLocationVehicleId}");

        Assert.DoesNotContain(list, v => v.Id == Fixture.OtherLocationVehicleId);
        Assert.Equal(HttpStatusCode.NotFound, direct.StatusCode);
    }

    [Fact]
    public async Task An_administrator_sees_the_whole_company()
    {
        var client = await App.SignInAsync("admin");

        var list = await (await client.GetAsync("/api/v1/vehicles")).ReadAsync<List<VehicleDto>>();

        Assert.Contains(list, v => v.Id == Fixture.TruckId);
        Assert.Contains(list, v => v.Id == Fixture.OtherLocationVehicleId);
    }

    [Fact]
    public async Task Only_administrators_can_create_vehicles()
    {
        var supervisor = await App.SignInAsync("supervisor");

        var response = await supervisor.PostJsonAsync("/api/v1/vehicles",
            new VehicleWriteRequest("900", "TEST-900", "Caminhão", null, 0, true));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_vehicle_is_created_with_a_server_generated_identifier_in_the_callers_company()
    {
        var admin = await App.SignInAsync("admin");

        var created = await (await admin.PostJsonAsync("/api/v1/vehicles",
            new VehicleWriteRequest("900", "test-900", "Caminhão", null, 1200, true))).ReadAsync<VehicleDto>();

        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(Fixture.CompanyId, created.CompanyId);
        Assert.Equal("TEST-900", created.Plate);
    }

    [Fact]
    public async Task Duplicate_internal_numbers_are_refused()
    {
        var admin = await App.SignInAsync("admin");

        var response = await admin.PostJsonAsync("/api/v1/vehicles",
            new VehicleWriteRequest("714", null, "Caminhão", null, null, true));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_location_from_another_company_is_refused()
    {
        var admin = await App.SignInAsync("admin");

        var response = await admin.PostJsonAsync("/api/v1/vehicles",
            new VehicleWriteRequest("901", null, "Caminhão", Fixture.OtherCompanyLocationId, null, true));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("locationId"));
    }
}

public sealed class UserAdminTests : ApiTestBase
{
    [Fact]
    public async Task Only_administrators_may_list_or_create_accounts()
    {
        var supervisor = await App.SignInAsync("supervisor");

        Assert.Equal(HttpStatusCode.Forbidden, (await supervisor.GetAsync("/api/v1/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await supervisor.PostJsonAsync("/api/v1/users",
            new CreateUserRequest("New", "new-user", "password-1234", UserRole.Inspector, null))).StatusCode);
    }

    [Fact]
    public async Task A_created_account_can_sign_in_and_its_password_is_never_stored_in_clear_text()
    {
        var admin = await App.SignInAsync("admin");

        var created = await (await admin.PostJsonAsync("/api/v1/users",
            new CreateUserRequest("Novo Inspetor", "novo", "password-1234", UserRole.Inspector, null)))
            .ReadAsync<UserDto>();

        Assert.Equal(UserRole.Inspector, created.Role);

        var stored = await App.WithDbAsync(db => db.Users.FirstAsync(u => u.Id == created.Id));
        Assert.DoesNotContain("password-1234", stored.PasswordHash, StringComparison.Ordinal);

        var client = await App.SignInAsync("novo", password: "password-1234");
        var me = await (await client.GetAsync("/api/v1/auth/me")).ReadAsync<UserDto>();
        Assert.Equal(created.Id, me.Id);
    }

    [Fact]
    public async Task A_short_password_is_refused()
    {
        var admin = await App.SignInAsync("admin");

        var response = await admin.PostJsonAsync("/api/v1/users",
            new CreateUserRequest("Curta", "curta", "123", UserRole.Inspector, null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.ReadProblemAsync()).Errors!.ContainsKey("password"));
    }

    [Fact]
    public async Task Duplicate_usernames_are_refused()
    {
        var admin = await App.SignInAsync("admin");

        var response = await admin.PostJsonAsync("/api/v1/users",
            new CreateUserRequest("Outro", "inspector", "password-1234", UserRole.Inspector, null));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task The_last_administrator_cannot_be_demoted_or_deactivated()
    {
        var admin = await App.SignInAsync("admin");

        var demote = await admin.PutJsonAsync($"/api/v1/users/{Fixture.AdminId}",
            new UpdateUserRequest(null, UserRole.Inspector, null, null));
        var deactivate = await admin.PutJsonAsync($"/api/v1/users/{Fixture.AdminId}",
            new UpdateUserRequest(null, null, false, null));

        Assert.Equal(HttpStatusCode.Conflict, demote.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, deactivate.StatusCode);

        var stored = await App.WithDbAsync(db => db.Users.FirstAsync(u => u.Id == Fixture.AdminId));
        Assert.Equal(UserRole.Administrator, stored.Role);
        Assert.True(stored.Active);
    }

    [Fact]
    public async Task An_administrator_can_be_demoted_once_another_one_exists()
    {
        var admin = await App.SignInAsync("admin");

        await admin.PostJsonAsync("/api/v1/users",
            new CreateUserRequest("Segundo Admin", "admin2", "password-1234", UserRole.Administrator, null));

        var demote = await admin.PutJsonAsync($"/api/v1/users/{Fixture.AdminId}",
            new UpdateUserRequest(null, UserRole.Supervisor, null, null));

        Assert.Equal(HttpStatusCode.OK, demote.StatusCode);
    }

    [Fact]
    public async Task Resetting_a_password_invalidates_the_previous_session()
    {
        var victim = await App.SignInAsync("inspector");
        var admin = await App.SignInAsync("admin");

        var reset = await admin.PutJsonAsync($"/api/v1/users/{Fixture.InspectorId}",
            new UpdateUserRequest(null, null, null, "brand-new-password"));
        reset.EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Unauthorized, (await victim.GetAsync("/api/v1/auth/me")).StatusCode);

        var reborn = await App.SignInAsync("inspector", password: "brand-new-password");
        Assert.Equal(HttpStatusCode.OK, (await reborn.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Administrative_changes_are_audited()
    {
        var admin = await App.SignInAsync("admin");
        await admin.PutJsonAsync($"/api/v1/users/{Fixture.InspectorId}",
            new UpdateUserRequest("Renamed", null, null, null));

        var audited = await App.WithDbAsync(db => db.AuditEntries
            .AnyAsync(a => a.Action == AuditActions.UserUpdated && a.EntityId == Fixture.InspectorId));

        Assert.True(audited);
    }
}
