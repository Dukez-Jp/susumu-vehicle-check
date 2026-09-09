using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Services;
using Susumu.Infrastructure.Time;

namespace Susumu.Api.Tests;

public sealed class VehicleTypeCatalogTests : ApiTestBase
{
    [Theory]
    [InlineData("admin")]
    [InlineData("supervisor")]
    [InlineData("inspector")]
    [InlineData("office")]
    public async Task Authenticated_company_roles_can_read_the_catalog(string username)
    {
        var client = await App.SignInAsync(username);
        var catalog = await (await client.GetAsync("/api/v1/vehicle-types")).ReadAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, catalog.ValueKind);
    }

    [Fact]
    public async Task Catalog_is_authenticated_and_writes_are_administrator_only()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await App.Anonymous.GetAsync("/api/v1/vehicle-types")).StatusCode);
        var supervisor = await App.SignInAsync("supervisor");
        Assert.Equal(HttpStatusCode.Forbidden, (await supervisor.PostJsonAsync("/api/v1/vehicle-types", new CreateVehicleTypeRequest("Denied", "Denied"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await supervisor.PutJsonAsync($"/api/v1/vehicle-types/{Guid.NewGuid()}", new UpdateVehicleTypeRequest("Denied", false))).StatusCode);
    }

    [Fact]
    public async Task New_codes_are_trimmed_canonical_and_unique_without_case_aliases()
    {
        var admin = await App.SignInAsync("admin");
        var created = await (await admin.PostJsonAsync("/api/v1/vehicle-types", new CreateVehicleTypeRequest("  Box Van  ", "  Furgão  "))).ReadAsync<VehicleTypeDto>();
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal("Box Van", created.Code);
        Assert.Equal("Furgão", created.Name);
        Assert.True(created.Active);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostJsonAsync("/api/v1/vehicle-types", new CreateVehicleTypeRequest("box VAN", "Alias"))).StatusCode);
        var vehicle = await (await admin.PostJsonAsync("/api/v1/vehicles", new VehicleWriteRequest("BOX", null, "box van", null, 0, true))).ReadAsync<VehicleDto>();
        Assert.Equal("Box Van", vehicle.Type);
        Assert.True(await App.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.EntityId == created.Id && a.Action == "vehicle-type.created" && a.CompanyId == Fixture.CompanyId)));
    }

    [Fact]
    public async Task Case_insensitive_uniqueness_is_isolated_to_each_company()
    {
        var foreignId = Guid.NewGuid();
        await App.WithDbAsync(async db =>
        {
            db.Set<VehicleType>().Add(new VehicleType
            {
                Id = foreignId, CompanyId = Fixture.OtherCompanyId, Code = "FOREIGN", NormalizedCode = "FOREIGN",
                Name = "Foreign", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
            });
            await db.SaveChangesAsync();
        });
        var admin = await App.SignInAsync("admin");
        var visible = await (await admin.GetAsync("/api/v1/vehicle-types")).ReadAsync<List<VehicleTypeDto>>();
        Assert.DoesNotContain(visible, t => t.Id == foreignId);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutJsonAsync($"/api/v1/vehicle-types/{foreignId}", new UpdateVehicleTypeRequest("Hijack", false))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostJsonAsync("/api/v1/vehicles", new VehicleWriteRequest("FOREIGN", null, "FOREIGN", null, 0, true))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await admin.PostJsonAsync("/api/v1/vehicle-types", new CreateVehicleTypeRequest("foreign", "Own company"))).StatusCode);
    }

    [Fact]
    public async Task Retiring_a_code_preserves_existing_vehicle_template_and_history_references()
    {
        var admin = await App.SignInAsync("admin");
        var inspector = await App.SignInAsync("inspector");
        var finalized = Inspection(Guid.NewGuid(), CompleteItems(), InspectionState.Finalized);
        (await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, finalized))).EnsureSuccessStatusCode();
        var catalog = await (await admin.GetAsync("/api/v1/vehicle-types")).ReadAsync<List<VehicleTypeDto>>();
        var type = catalog.Single(t => t.Code == "Caminhão");
        var retired = await (await admin.PutJsonAsync($"/api/v1/vehicle-types/{type.Id}", new
        {
            code = "CHANGED-BY-CLIENT", name = "Historic truck", active = false,
        })).ReadAsync<VehicleTypeDto>();
        Assert.Equal("Caminhão", retired.Code);
        Assert.False(retired.Active);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostJsonAsync("/api/v1/vehicles", new VehicleWriteRequest("NEW", null, "Caminhão", null, 0, true))).StatusCode);
        var edited = await (await admin.PutJsonAsync($"/api/v1/vehicles/{Fixture.TruckId}", new VehicleWriteRequest(null, "UPDATED", "CAMINHÃO", null, null, null))).ReadAsync<VehicleDto>();
        Assert.Equal("Caminhão", edited.Type);
        var history = await (await inspector.GetAsync($"/api/v1/inspections/{finalized.Id}")).ReadAsync<InspectionDto>();
        Assert.Equal(InspectionState.Finalized, history.State);
        Assert.Equal(Fixture.TemplateId, history.TemplateId);
        Assert.Equal("Caminhão", await App.WithDbAsync(db => db.ChecklistTemplates.Where(t => t.Id == Fixture.TemplateId).Select(t => t.VehicleType).SingleAsync()));
        Assert.True(await App.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.EntityId == type.Id && a.Action == "vehicle-type.updated")));
    }

    [Fact]
    public async Task Changing_an_existing_vehicle_requires_an_active_catalog_code()
    {
        var admin = await App.SignInAsync("admin");
        var catalog = await (await admin.GetAsync("/api/v1/vehicle-types")).ReadAsync<List<VehicleTypeDto>>();
        var van = catalog.Single(t => t.Code == "Van");
        (await admin.PutJsonAsync($"/api/v1/vehicle-types/{van.Id}", new UpdateVehicleTypeRequest(van.Name, false))).EnsureSuccessStatusCode();
        foreach (var code in new[] { "Unknown", "Van" })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutJsonAsync($"/api/v1/vehicles/{Fixture.TruckId}", new VehicleWriteRequest(null, null, code, null, null, null))).StatusCode);
        }
        var changed = await (await admin.PutJsonAsync($"/api/v1/vehicles/{Fixture.TruckId}", new VehicleWriteRequest(null, null, "truck", null, null, null))).ReadAsync<VehicleDto>();
        Assert.Equal("Truck", changed.Type);
        (await admin.PutJsonAsync($"/api/v1/vehicle-types/{van.Id}", new UpdateVehicleTypeRequest(van.Name, true))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await admin.PutJsonAsync($"/api/v1/vehicles/{Fixture.TruckId}", new VehicleWriteRequest(null, null, "van", null, null, null))).StatusCode);
    }

    [Fact]
    public async Task A_new_template_requires_an_active_type_even_when_copying_a_retired_definition()
    {
        var admin = await App.SignInAsync("admin");
        var supervisor = await App.SignInAsync("supervisor");
        var types = await (await supervisor.GetAsync("/api/v1/vehicle-types")).ReadAsync<List<VehicleTypeDto>>();
        var type = types.Single(t => t.Code == "Caminhão");
        (await admin.PutJsonAsync($"/api/v1/vehicle-types/{type.Id}", new UpdateVehicleTypeRequest(type.Name, false))).EnsureSuccessStatusCode();
        var response = await supervisor.PostJsonAsync("/api/v1/templates", new TemplateWriteRequest(
            "Copied definition", "Caminhão", false,
            [new ChecklistSectionWriteDto(null, "Section", [new ChecklistItemWriteDto(null, "Brake", ResponseType.Status, true, null, null, null)])]));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(1, await App.WithDbAsync(db => db.ChecklistTemplates.CountAsync()));
    }

    [Fact]
    public async Task Concurrent_case_aliases_commit_one_catalog_entry_and_one_audit()
    {
        var admin = await App.SignInAsync("admin");
        var responses = await Task.WhenAll(
            admin.PostJsonAsync("/api/v1/vehicle-types", new CreateVehicleTypeRequest("Cargo", "Cargo")),
            admin.PostJsonAsync("/api/v1/vehicle-types", new CreateVehicleTypeRequest("cARGO", "Alias")));
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(1, await App.WithDbAsync(db => db.Set<VehicleType>().CountAsync(t => t.NormalizedCode == "CARGO")));
        Assert.Equal(1, await App.WithDbAsync(db => db.AuditEntries.CountAsync(a => a.Action == "vehicle-type.created")));
    }

    [Fact]
    public async Task Invalid_catalog_payloads_do_not_create_a_record_or_audit()
    {
        var admin = await App.SignInAsync("admin");
        foreach (var request in new[]
        {
            new CreateVehicleTypeRequest(null, "Name"), new CreateVehicleTypeRequest(" ", "Name"),
            new CreateVehicleTypeRequest(new string('X', 81), "Name"), new CreateVehicleTypeRequest("A\nB", "Name"),
            new CreateVehicleTypeRequest("Code", " "), new CreateVehicleTypeRequest("Code", new string('X', 121)),
            new CreateVehicleTypeRequest("Code", "Name\tInvalid"),
        })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostJsonAsync("/api/v1/vehicle-types", request)).StatusCode);
        }
        Assert.Equal(3, await App.WithDbAsync(db => db.Set<VehicleType>().CountAsync()));
        Assert.Equal(0, await App.WithDbAsync(db => db.AuditEntries.CountAsync(a => a.EntityType == "vehicle-type")));
    }

    [Fact]
    public async Task Catalog_mutations_revalidate_the_persisted_actor_after_authentication()
    {
        var actor = new CurrentUser(Fixture.AdminId, Fixture.CompanyId, Fixture.LocationId, UserRole.Administrator, "Admin", "admin");
        await App.WithDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Id == actor.Id)).Role = UserRole.Inspector;
            await db.SaveChangesAsync();
        });
        using var scope = App.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SusumuDbContext>();
        var service = new VehicleTypeService(db, new SystemClock());
        var denied = await Assert.ThrowsAsync<AppException>(() => service.CreateAsync(actor, new CreateVehicleTypeRequest("Denied", "Denied"), CancellationToken.None));
        Assert.Equal((int)HttpStatusCode.Forbidden, denied.Status);
    }
}
