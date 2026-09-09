using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Services;
using Susumu.Infrastructure.Time;

namespace Susumu.Api.Tests;

[Collection(EnvironmentSensitiveCollection.Name)]
public sealed class AdminLockFollowupTests : ApiTestBase
{
    public static IEnumerable<object[]> RevokedOperations()
        => from operation in new[] { "create-user", "update-user", "create-vehicle", "update-vehicle" }
           from revoked in new[] { "role", "account", "company", "location" }
           select new object[] { operation, revoked };

    [Theory]
    [MemberData(nameof(RevokedOperations))]
    public async Task Administrative_writes_recheck_persisted_actor_after_authentication(string operation, string revoked)
    {
        var actor = Actor();
        await App.WithDbAsync(async db =>
        {
            var user = await db.Users.SingleAsync(u => u.Id == actor.Id);
            if (revoked == "role") { user.Role = UserRole.Inspector; }
            if (revoked == "account") { user.Active = false; }
            if (revoked == "company") { (await db.Companies.SingleAsync(c => c.Id == actor.CompanyId)).Active = false; }
            if (revoked == "location") { (await db.Locations.SingleAsync(l => l.Id == actor.LocationId)).Active = false; }
            await db.SaveChangesAsync();
        });
        using var scope = App.CreateScope();
        var exception = await Assert.ThrowsAsync<AppException>(() => ChangeAsync(
            scope.ServiceProvider.GetRequiredService<SusumuDbContext>(), actor, operation));
        Assert.Equal((int)HttpStatusCode.Forbidden, exception.Status);
        Assert.Equal(0, await App.WithDbAsync(db => db.AuditEntries.CountAsync()));
        Assert.Equal("Inspector", await App.WithDbAsync(db => db.Users.Where(u => u.Id == Fixture.InspectorId).Select(u => u.Name).SingleAsync()));
        Assert.Equal("TEST-714", await App.WithDbAsync(db => db.Vehicles.Where(v => v.Id == Fixture.TruckId).Select(v => v.Plate).SingleAsync()));
    }

    [Theory]
    [InlineData("create-user")]
    [InlineData("create-vehicle")]
    public async Task A_default_location_is_validated_even_when_an_authenticated_actor_snapshot_is_stale(string operation)
    {
        var actor = Actor();
        await App.WithDbAsync(async db =>
        {
            (await db.Users.SingleAsync(u => u.Id == actor.Id)).LocationId = Fixture.SecondLocationId;
            (await db.Locations.SingleAsync(l => l.Id == actor.LocationId)).Active = false;
            await db.SaveChangesAsync();
        });
        using var scope = App.CreateScope();
        var exception = await Assert.ThrowsAsync<AppException>(() => ChangeAsync(
            scope.ServiceProvider.GetRequiredService<SusumuDbContext>(), actor, operation));
        Assert.Equal((int)HttpStatusCode.BadRequest, exception.Status);
        Assert.Contains("locationId", exception.Errors!.Keys);
        Assert.Equal(0, await App.WithDbAsync(db => db.AuditEntries.CountAsync()));
    }

    [Theory]
    [InlineData("user")]
    [InlineData("vehicle")]
    public async Task Reactivation_without_locationId_rejects_a_closed_effective_location(string resource)
    {
        var admin = await App.SignInAsync("admin");
        var location = await (await admin.PostJsonAsync("/api/v1/locations", new CreateLocationRequest("Retired Workshop"))).ReadAsync<LocationDto>();
        Guid id;
        if (resource == "user")
        {
            var created = await (await admin.PostJsonAsync("/api/v1/users", new CreateUserRequest(
                "Retired User", "retired-user", TestApp.Password, UserRole.Inspector, location.Id))).ReadAsync<UserDto>();
            id = created.Id;
            (await admin.PutJsonAsync($"/api/v1/users/{id}", new UpdateUserRequest(null, null, false, null))).EnsureSuccessStatusCode();
        }
        else
        {
            var created = await (await admin.PostJsonAsync("/api/v1/vehicles", new VehicleWriteRequest(
                "RETIRED", null, "Truck", location.Id, 0, false))).ReadAsync<VehicleDto>();
            id = created.Id;
        }

        (await admin.PutJsonAsync($"/api/v1/locations/{location.Id}", new UpdateLocationRequest(location.Name, false))).EnsureSuccessStatusCode();
        var auditsBefore = await App.WithDbAsync(db => db.AuditEntries.CountAsync());
        var response = resource == "user"
            ? await admin.PutJsonAsync($"/api/v1/users/{id}", new UpdateUserRequest(null, null, true, null))
            : await admin.PutJsonAsync($"/api/v1/vehicles/{id}", new VehicleWriteRequest(null, null, null, null, null, true));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("locationId", (await response.ReadProblemAsync()).Errors!.Keys);
        Assert.Equal(auditsBefore, await App.WithDbAsync(db => db.AuditEntries.CountAsync()));
        var active = await App.WithDbAsync(db => resource == "user"
            ? db.Users.Where(u => u.Id == id).Select(u => u.Active).SingleAsync()
            : db.Vehicles.Where(v => v.Id == id).Select(v => v.Active).SingleAsync());
        Assert.False(active);
        // An inactive historical record remains editable without implicitly reactivating it.
        var edit = resource == "user"
            ? await admin.PutJsonAsync($"/api/v1/users/{id}", new UpdateUserRequest("Historical User", null, null, null))
            : await admin.PutJsonAsync($"/api/v1/vehicles/{id}", new VehicleWriteRequest(null, "HISTORICAL", null, null, null, null));
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);
    }

    [PostgresFact]
    public async Task PostgreSQL_proves_all_four_writes_wait_on_company_lock_then_reject_committed_revocation()
    {
        // Same explicit allowlist/opt-in as all destructive integration tests, before any connection.
        var connectionString = PostgresTestDatabase.RequireApprovedTarget();
        var options = new DbContextOptionsBuilder<SusumuDbContext>().UseNpgsql(connectionString).Options;
        await using (var setup = new SusumuDbContext(options))
        {
            await setup.Database.EnsureDeletedAsync();
            await setup.Database.MigrateAsync();
            var now = DateTimeOffset.UtcNow;
            setup.Companies.Add(new Company { Id = Fixture.CompanyId, Name = "Lock Test", CreatedAt = now });
            setup.Set<VehicleType>().Add(new VehicleType
            {
                Id = Guid.NewGuid(), CompanyId = Fixture.CompanyId, Code = "Truck", NormalizedCode = "TRUCK",
                Name = "Truck", Active = true, CreatedAt = now, UpdatedAt = now, Version = 1,
            });
            setup.Locations.Add(new Location { Id = Fixture.LocationId, CompanyId = Fixture.CompanyId, Name = "Lock Workshop", CreatedAt = now });
            foreach (var id in new[] { Fixture.AdminId, Fixture.InspectorId, Fixture.SupervisorId })
            {
                setup.Users.Add(new AppUser
                {
                    Id = id, CompanyId = Fixture.CompanyId, LocationId = Fixture.LocationId,
                    Name = "Lock User", Username = id.ToString("N"), PasswordHash = "unused-test-hash",
                    Role = id == Fixture.InspectorId ? UserRole.Inspector : UserRole.Administrator,
                    SecurityStamp = Guid.NewGuid().ToString("N"), CreatedAt = now, UpdatedAt = now,
                });
            }

            setup.Vehicles.Add(new Vehicle
            {
                Id = Fixture.TruckId, CompanyId = Fixture.CompanyId, LocationId = Fixture.LocationId,
                InternalNumber = "714", Type = "Truck", Plate = "TEST-714", CreatedAt = now, UpdatedAt = now,
            });
            await setup.SaveChangesAsync();
        }

        foreach (var operation in new[] { "create-user", "update-user", "create-vehicle", "update-vehicle" })
        foreach (var deactivate in new[] { false, true })
        {
            await using var blocker = new SusumuDbContext(options);
            var actorRow = await blocker.Users.SingleAsync(u => u.Id == Fixture.AdminId);
            actorRow.Active = true;
            actorRow.Role = UserRole.Administrator;
            await blocker.SaveChangesAsync();
            await using var held = await OrganizationAdministrationService.BeginCompanyWriteAsync(blocker, Fixture.CompanyId, CancellationToken.None);
            if (deactivate) { actorRow.Active = false; } else { actorRow.Role = UserRole.Inspector; }
            await blocker.SaveChangesAsync();
            await using var waitingConnection = new NpgsqlConnection(connectionString);
            await waitingConnection.OpenAsync();
            await using var waitingDb = new SusumuDbContext(new DbContextOptionsBuilder<SusumuDbContext>().UseNpgsql(waitingConnection).Options);
            var write = ChangeAsync(waitingDb, Actor(), operation);
            // Observe PostgreSQL's actual lock wait, not a delay that merely hopes the request started.
            await using var observer = new NpgsqlConnection(connectionString);
            await observer.OpenAsync();
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            try
            {
                while (true)
                {
                    await using var query = new NpgsqlCommand("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pid = @pid AND wait_event_type = 'Lock')", observer);
                    query.Parameters.AddWithValue("pid", waitingConnection.ProcessID);
                    if ((bool)(await query.ExecuteScalarAsync(deadline.Token))!) { break; }
                    Assert.False(write.IsCompleted, "Administrative write completed without waiting for the company lock.");
                    await Task.Delay(20, deadline.Token);
                }

                await held.CommitAsync();
                var rejection = await Assert.ThrowsAsync<AppException>(() => write.WaitAsync(TimeSpan.FromSeconds(15)));
                Assert.Equal((int)HttpStatusCode.Forbidden, rejection.Status);
            }
            finally
            {
                // On assertion failure release only this test-owned transaction before disposing its waiter.
                if (blocker.Database.CurrentTransaction is not null) { await held.RollbackAsync(); }
            }
        }

        await using var verification = new SusumuDbContext(options);
        Assert.Equal(0, await verification.AuditEntries.CountAsync());
        Assert.Equal(3, await verification.Users.CountAsync());
        Assert.Equal(1, await verification.Vehicles.CountAsync());
    }

    private CurrentUser Actor() => new(Fixture.AdminId, Fixture.CompanyId, Fixture.LocationId, UserRole.Administrator, "Admin", "admin");

    private async Task ChangeAsync(SusumuDbContext db, CurrentUser actor, string operation)
    {
        using var scope = App.CreateScope();
        var users = new UserAdminService(db, scope.ServiceProvider.GetRequiredService<IPasswordHashing>(), new SystemClock());
        var vehicles = new VehicleService(db, new SystemClock());
        switch (operation)
        {
            case "create-user": await users.CreateAsync(actor, new CreateUserRequest("Created User", "created-user", TestApp.Password, UserRole.Inspector, null), CancellationToken.None); break;
            case "update-user": await users.UpdateAsync(actor, Fixture.InspectorId, new UpdateUserRequest("Changed User", null, null, null), CancellationToken.None); break;
            case "create-vehicle": await vehicles.CreateAsync(actor, new VehicleWriteRequest("CREATED", null, "Truck", null, 0, true), CancellationToken.None); break;
            case "update-vehicle": await vehicles.UpdateAsync(actor, Fixture.TruckId, new VehicleWriteRequest(null, "CHANGED", null, null, null, null), CancellationToken.None); break;
            default: throw new ArgumentOutOfRangeException(nameof(operation));
        }
    }
}
