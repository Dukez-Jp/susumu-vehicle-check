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

public sealed class OrganizationAdministrationTests : ApiTestBase
{
    [Fact]
    public async Task An_administrator_reads_and_renames_only_its_own_company_with_audit()
    {
        var admin = await App.SignInAsync("admin");
        var current = await (await admin.GetAsync("/api/v1/company")).ReadAsync<JsonElement>();
        Assert.Equal(Fixture.CompanyId, current.GetProperty("id").GetGuid());

        var renamed = await (await admin.PutJsonAsync("/api/v1/company", new { name = "  Workshop Group  " }))
            .ReadAsync<JsonElement>();
        Assert.Equal("Workshop Group", renamed.GetProperty("name").GetString());
        Assert.Equal("Other Company", await App.WithDbAsync(db => db.Companies
            .Where(c => c.Id == Fixture.OtherCompanyId).Select(c => c.Name).SingleAsync()));
        Assert.True(await App.WithDbAsync(db => db.AuditEntries.AnyAsync(a =>
            a.CompanyId == Fixture.CompanyId && a.ActorId == Fixture.AdminId &&
            a.EntityId == Fixture.CompanyId && a.Action == "company.updated")));
    }

    [Theory]
    [InlineData("/api/v1/company")]
    [InlineData("/api/v1/locations")]
    [InlineData("/api/v1/employees")]
    public async Task Organization_reads_require_an_administrator(string path)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await App.Anonymous.GetAsync(path)).StatusCode);
        var supervisor = await App.SignInAsync("supervisor");
        Assert.Equal(HttpStatusCode.Forbidden, (await supervisor.GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task All_organization_writes_reject_a_non_administrator()
    {
        var inspector = await App.SignInAsync("inspector");
        Assert.Equal(HttpStatusCode.Forbidden, (await inspector.PutJsonAsync("/api/v1/company", new { name = "Hijack" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await inspector.PostJsonAsync("/api/v1/locations", new { name = "Hijack" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await inspector.PutJsonAsync($"/api/v1/locations/{Fixture.LocationId}", new { name = "Hijack", active = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await inspector.PostJsonAsync("/api/v1/employees", EmployeeRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await inspector.PutJsonAsync($"/api/v1/employees/{Guid.NewGuid()}", EmployeeRequest())).StatusCode);
    }

    [Fact]
    public async Task Locations_are_company_scoped_and_a_new_location_can_be_retired_without_deletion()
    {
        var admin = await App.SignInAsync("admin");
        var locations = await (await admin.GetAsync("/api/v1/locations")).ReadAsync<List<LocationDto>>();
        Assert.Equal(2, locations.Count);
        Assert.All(locations, location => Assert.Equal(Fixture.CompanyId, location.CompanyId));
        Assert.DoesNotContain(locations, location => location.Id == Fixture.OtherCompanyLocationId);

        var created = await (await admin.PostJsonAsync("/api/v1/locations", new { name = "  Store  " })).ReadAsync<LocationDto>();
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(Fixture.CompanyId, created.CompanyId);
        Assert.Equal("Store", created.Name);
        var retired = await (await admin.PutJsonAsync($"/api/v1/locations/{created.Id}", new { name = "Store", active = false })).ReadAsync<LocationDto>();
        Assert.False(retired.Active);
        Assert.True(await App.WithDbAsync(db => db.Locations.AnyAsync(l => l.Id == created.Id && !l.Active)));
        Assert.Equal(2, await App.WithDbAsync(db => db.AuditEntries.CountAsync(a => a.EntityId == created.Id)));
        var foreign = await admin.PutJsonAsync($"/api/v1/locations/{Fixture.OtherCompanyLocationId}", new { name = "Hijack", active = false });
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
    }

    [Theory]
    [InlineData("user")]
    [InlineData("vehicle")]
    [InlineData("employee")]
    public async Task An_active_assignment_blocks_location_deactivation_and_writes_no_success_audit(string assignment)
    {
        var admin = await App.SignInAsync("admin");
        var location = await (await admin.PostJsonAsync("/api/v1/locations", new { name = "Assigned" })).ReadAsync<LocationDto>();
        await App.WithDbAsync(async db =>
        {
            if (assignment == "user") { (await db.Users.SingleAsync(u => u.Id == Fixture.InspectorId)).LocationId = location.Id; }
            if (assignment == "vehicle") { (await db.Vehicles.SingleAsync(v => v.Id == Fixture.TruckId)).LocationId = location.Id; }
            if (assignment == "employee")
            {
                db.Set<Employee>().Add(new Employee
                {
                    Id = Guid.NewGuid(), CompanyId = Fixture.CompanyId, LocationId = location.Id,
                    EmployeeNumber = "ASSIGNED", Name = "Assigned Employee", Active = true,
                    CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
                });
            }

            await db.SaveChangesAsync();
        });

        var response = await admin.PutJsonAsync($"/api/v1/locations/{location.Id}", new { name = "Changed", active = false });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var stored = await App.WithDbAsync(db => db.Locations.SingleAsync(l => l.Id == location.Id));
        Assert.True(stored.Active);
        Assert.Equal("Assigned", stored.Name);
        Assert.False(await App.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.EntityId == location.Id && a.Action == "location.updated")));
    }

    [Fact]
    public async Task The_last_active_location_cannot_be_deactivated()
    {
        var admin = await App.SignInAsync("admin");
        await App.WithDbAsync(async db =>
        {
            (await db.Locations.SingleAsync(l => l.Id == Fixture.SecondLocationId)).Active = false;
            await db.SaveChangesAsync();
        });
        var response = await admin.PutJsonAsync($"/api/v1/locations/{Fixture.LocationId}", new { name = "Workshop A", active = false });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("last active location", (await response.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task Duplicate_or_invalid_company_and_location_names_are_rejected_without_partial_changes()
    {
        var admin = await App.SignInAsync("admin");
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutJsonAsync("/api/v1/company", new { name = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutJsonAsync("/api/v1/company", new { name = "Other Company" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostJsonAsync("/api/v1/locations", new { name = "Workshop A" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostJsonAsync("/api/v1/locations", new { name = new string('x', 201) })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutJsonAsync($"/api/v1/locations/{Fixture.LocationId}", new { name = "Valid" })).StatusCode);
        Assert.Equal("Test Company", await App.WithDbAsync(db => db.Companies.Where(c => c.Id == Fixture.CompanyId).Select(c => c.Name).SingleAsync()));
    }

    [Fact]
    public async Task Employee_retirement_preserves_login_and_finalized_history()
    {
        var admin = await App.SignInAsync("admin");
        var inspector = await App.SignInAsync("inspector");
        var inspection = Inspection(Guid.NewGuid(), CompleteItems(), InspectionState.Finalized);
        (await inspector.PostJsonAsync("/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, inspection))).EnsureSuccessStatusCode();
        var employee = await (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(userId: Fixture.InspectorId))).ReadAsync<EmployeeDto>();
        Assert.NotEqual(Guid.Empty, employee.Id);
        Assert.Equal("E001", employee.EmployeeNumber);
        var retired = await (await admin.PutJsonAsync($"/api/v1/employees/{employee.Id}", EmployeeRequest(userId: Fixture.InspectorId, active: false))).ReadAsync<EmployeeDto>();
        Assert.False(retired.Active);
        Assert.Equal(HttpStatusCode.OK, (await inspector.GetAsync("/api/v1/auth/me")).StatusCode);
        var history = await (await inspector.GetAsync($"/api/v1/inspections/{inspection.Id}")).ReadAsync<InspectionDto>();
        Assert.Equal(InspectionState.Finalized, history.State);
        Assert.True(await App.WithDbAsync(db => db.Set<Employee>().AnyAsync(e => e.Id == employee.Id && !e.Active)));
        Assert.True(await App.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.EntityId == employee.Id && a.Action == "employee.updated" && a.ActorId == Fixture.AdminId)));
    }

    [Fact]
    public async Task Employee_number_and_user_link_remain_unique_even_after_retirement()
    {
        var admin = await App.SignInAsync("admin");
        var first = await (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(userId: Fixture.InspectorId))).ReadAsync<EmployeeDto>();
        (await admin.PutJsonAsync($"/api/v1/employees/{first.Id}", EmployeeRequest(userId: Fixture.InspectorId, active: false))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(number: " e001 "))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(number: "E002", userId: Fixture.InspectorId))).StatusCode);
        var second = await (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(number: "E002"))).ReadAsync<EmployeeDto>();
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutJsonAsync($"/api/v1/employees/{second.Id}", EmployeeRequest(number: "E001"))).StatusCode);
        Assert.Equal("E002", await App.WithDbAsync(db => db.Set<Employee>().Where(e => e.Id == second.Id).Select(e => e.EmployeeNumber).SingleAsync()));
    }

    [Fact]
    public async Task Unlinking_an_employee_releases_only_the_explicit_user_link()
    {
        var admin = await App.SignInAsync("admin");
        var first = await (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(userId: Fixture.InspectorId))).ReadAsync<EmployeeDto>();
        var unlinked = await (await admin.PutJsonAsync($"/api/v1/employees/{first.Id}", EmployeeRequest())).ReadAsync<EmployeeDto>();
        Assert.Null(unlinked.UserId);
        var linked = await (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(number: "E002", userId: Fixture.InspectorId))).ReadAsync<EmployeeDto>();
        Assert.Equal(Fixture.InspectorId, linked.UserId);
    }

    [Fact]
    public async Task An_active_employee_requires_active_same_company_location_and_user()
    {
        var admin = await App.SignInAsync("admin");
        var closed = await (await admin.PostJsonAsync("/api/v1/locations", new { name = "Closed" })).ReadAsync<LocationDto>();
        (await admin.PutJsonAsync($"/api/v1/locations/{closed.Id}", new { name = "Closed", active = false })).EnsureSuccessStatusCode();
        foreach (var request in new[]
                 {
                     EmployeeRequest(locationId: Fixture.OtherCompanyLocationId),
                     EmployeeRequest(locationId: closed.Id),
                     EmployeeRequest(userId: Fixture.InactiveId),
                     EmployeeRequest(userId: Guid.NewGuid()),
                 })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostJsonAsync("/api/v1/employees", request)).StatusCode);
        }

        Assert.Equal(0, await App.WithDbAsync(db => db.Set<Employee>().CountAsync()));
    }

    [Fact]
    public async Task Employee_lists_updates_and_user_links_never_cross_company_boundaries()
    {
        var admin = await App.SignInAsync("admin");
        var foreignUserId = Guid.NewGuid();
        var foreignEmployeeId = Guid.NewGuid();
        await App.WithDbAsync(async db =>
        {
            var now = DateTimeOffset.UtcNow;
            db.Users.Add(new AppUser
            {
                Id = foreignUserId, CompanyId = Fixture.OtherCompanyId, LocationId = Fixture.OtherCompanyLocationId,
                Name = "Foreign User", Username = "foreign-user", Role = UserRole.Inspector,
                PasswordHash = (await db.Users.SingleAsync(u => u.Id == Fixture.AdminId)).PasswordHash,
                SecurityStamp = Guid.NewGuid().ToString("N"), CreatedAt = now, UpdatedAt = now,
            });
            db.Set<Employee>().Add(new Employee
            {
                Id = foreignEmployeeId, CompanyId = Fixture.OtherCompanyId, LocationId = Fixture.OtherCompanyLocationId,
                UserId = foreignUserId, EmployeeNumber = "E001", Name = "Foreign Employee", CreatedAt = now, UpdatedAt = now,
            });
            await db.SaveChangesAsync();
        });
        var own = await (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest())).ReadAsync<EmployeeDto>();
        var list = await (await admin.GetAsync("/api/v1/employees")).ReadAsync<List<EmployeeDto>>();
        Assert.Equal(own.Id, Assert.Single(list).Id);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutJsonAsync($"/api/v1/employees/{foreignEmployeeId}", EmployeeRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(number: "E002", userId: foreignUserId))).StatusCode);
    }

    [Fact]
    public async Task Client_supplied_company_and_identifiers_cannot_choose_resource_ownership()
    {
        var admin = await App.SignInAsync("admin");
        var suppliedId = Guid.NewGuid();
        var location = await (await admin.PostJsonAsync("/api/v1/locations", new
        {
            id = suppliedId, companyId = Fixture.OtherCompanyId, name = "Owned Here",
        })).ReadAsync<LocationDto>();
        Assert.NotEqual(suppliedId, location.Id);
        Assert.Equal(Fixture.CompanyId, location.CompanyId);
        var employee = await (await admin.PostJsonAsync("/api/v1/employees", new
        {
            id = suppliedId, companyId = Fixture.OtherCompanyId, userId = (Guid?)null,
            employeeNumber = "OWNED", name = "Owned Here", locationId = location.Id, active = true,
        })).ReadAsync<EmployeeDto>();
        Assert.NotEqual(suppliedId, employee.Id);
        Assert.Equal(Fixture.CompanyId, await App.WithDbAsync(db => db.Set<Employee>()
            .Where(e => e.Id == employee.Id).Select(e => e.CompanyId).SingleAsync()));
    }

    [Fact]
    public async Task Employee_missing_or_malformed_fields_are_rejected_before_any_write()
    {
        var admin = await App.SignInAsync("admin");
        var requests = new[]
        {
            EmployeeRequest() with { EmployeeNumber = " " },
            EmployeeRequest() with { EmployeeNumber = new string('x', 41) },
            EmployeeRequest() with { Name = "Invalid\nName" },
            EmployeeRequest() with { Name = new string('x', 201) },
            EmployeeRequest() with { LocationId = null },
            EmployeeRequest() with { LocationId = Guid.Empty },
            EmployeeRequest() with { Active = null },
        };
        foreach (var request in requests)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostJsonAsync("/api/v1/employees", request)).StatusCode);
        }

        Assert.Equal(0, await App.WithDbAsync(db => db.Set<Employee>().CountAsync()));
        Assert.Equal(0, await App.WithDbAsync(db => db.AuditEntries.CountAsync(a => a.EntityType == "employee")));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Concurrent_duplicate_employee_creation_has_one_success_and_one_audit(bool sameUser)
    {
        var admin = await App.SignInAsync("admin");
        var first = EmployeeRequest(userId: sameUser ? Fixture.InspectorId : null);
        var second = EmployeeRequest(number: sameUser ? "E002" : "E001", userId: sameUser ? Fixture.InspectorId : null);
        var responses = await Task.WhenAll(admin.PostJsonAsync("/api/v1/employees", first), admin.PostJsonAsync("/api/v1/employees", second));
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(1, await App.WithDbAsync(db => db.Set<Employee>().CountAsync()));
        Assert.Equal(1, await App.WithDbAsync(db => db.AuditEntries.CountAsync(a => a.Action == "employee.created")));
    }

    [Theory]
    [InlineData("user")]
    [InlineData("vehicle")]
    [InlineData("employee")]
    public async Task A_concurrent_assignment_cannot_land_in_a_deactivated_location(string assignment)
    {
        var admin = await App.SignInAsync("admin");
        var location = await (await admin.PostJsonAsync("/api/v1/locations", new { name = "Concurrent Assignment" })).ReadAsync<LocationDto>();
        var create = assignment switch
        {
            "user" => admin.PostJsonAsync("/api/v1/users", new CreateUserRequest(
                "Concurrent User", "concurrent-user", TestApp.Password, UserRole.Inspector, location.Id)),
            "vehicle" => admin.PostJsonAsync("/api/v1/vehicles", new VehicleWriteRequest(
                "CONCURRENT", null, "Truck", location.Id, 0, true)),
            _ => admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(locationId: location.Id)),
        };
        var deactivate = admin.PutJsonAsync($"/api/v1/locations/{location.Id}", new { name = location.Name, active = false });
        await Task.WhenAll(create, deactivate);
        var active = await App.WithDbAsync(db => db.Locations.Where(l => l.Id == location.Id).Select(l => l.Active).SingleAsync());
        var assignments = await App.WithDbAsync(async db =>
            await db.Users.CountAsync(u => u.LocationId == location.Id && u.Active) +
            await db.Vehicles.CountAsync(v => v.LocationId == location.Id && v.Active) +
            await db.Set<Employee>().CountAsync(e => e.LocationId == location.Id && e.Active));
        Assert.False(!active && assignments > 0, "An active assignment was committed to an inactive location.");
        if ((await create).StatusCode == HttpStatusCode.Created)
        {
            Assert.Equal(HttpStatusCode.Conflict, (await deactivate).StatusCode);
        }
        else
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await create).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await deactivate).StatusCode);
        }
    }

    [Theory]
    [InlineData("number")]
    [InlineData("user")]
    [InlineData("foreign-location")]
    [InlineData("foreign-user")]
    public async Task Database_constraints_protect_uniqueness_and_company_scope_without_service_validation(string violation)
    {
        var admin = await App.SignInAsync("admin");
        await (await admin.PostJsonAsync("/api/v1/employees", EmployeeRequest(userId: Fixture.InspectorId))).ReadAsync<EmployeeDto>();
        await Assert.ThrowsAsync<DbUpdateException>(() => App.WithDbAsync(async db =>
        {
            var employee = new Employee
            {
                Id = Guid.NewGuid(), CompanyId = Fixture.CompanyId, LocationId = Fixture.LocationId,
                EmployeeNumber = violation == "number" ? "E001" : "E002", Name = "Invalid Direct Writer",
                UserId = violation == "user" ? Fixture.InspectorId : null,
                CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
            };
            if (violation == "foreign-location") { employee.LocationId = Fixture.OtherCompanyLocationId; }
            if (violation == "foreign-user")
            {
                employee.CompanyId = Fixture.OtherCompanyId;
                employee.LocationId = Fixture.OtherCompanyLocationId;
                employee.UserId = Fixture.SecondInspectorId;
            }

            db.Set<Employee>().Add(employee);
            await db.SaveChangesAsync();
        }));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task A_stale_administrator_cannot_write_after_account_revocation_commits(bool deactivate)
    {
        var actor = new CurrentUser(Fixture.AdminId, Fixture.CompanyId, Fixture.LocationId,
            UserRole.Administrator, "Admin", "admin");
        using var revocationScope = App.CreateScope();
        var revocationDb = revocationScope.ServiceProvider.GetRequiredService<SusumuDbContext>();
        await using var barrier = await OrganizationAdministrationService.BeginCompanyWriteAsync(
            revocationDb, Fixture.CompanyId, CancellationToken.None);
        var user = await revocationDb.Users.SingleAsync(u => u.Id == Fixture.AdminId);
        if (deactivate) { user.Active = false; } else { user.Role = UserRole.Inspector; }
        await revocationDb.SaveChangesAsync();
        // Keep a revocation transaction open while dispatching a request with a pre-revocation
        // actor. Scheduling may begin the request before or after commit; both must re-read it.
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var queued = Task.Run(async () =>
        {
            using var requestScope = App.CreateScope();
            var service = new OrganizationAdministrationService(
                requestScope.ServiceProvider.GetRequiredService<SusumuDbContext>(), new SystemClock());
            entered.SetResult();
            return await Assert.ThrowsAsync<AppException>(() => service.UpdateCompanyAsync(
                actor, new CompanyWriteRequest("Unauthorized rename"), CancellationToken.None));
        });
        await entered.Task;
        Assert.False(queued.IsCompleted);
        await barrier.CommitAsync();
        var denial = await queued.WaitAsync(TimeSpan.FromSeconds(15));
        Assert.Equal((int)HttpStatusCode.Forbidden, denial.Status);
        Assert.Equal("Test Company", await App.WithDbAsync(db => db.Companies
            .Where(c => c.Id == Fixture.CompanyId).Select(c => c.Name).SingleAsync()));
        Assert.False(await App.WithDbAsync(db => db.AuditEntries.AnyAsync(a => a.Action == "company.updated")));
    }

    private EmployeeWriteRequest EmployeeRequest(
        string number = " e001 ", Guid? userId = null, Guid? locationId = null, bool active = true)
        => new(userId, number, "Employee One", locationId ?? Fixture.LocationId, active);
}
