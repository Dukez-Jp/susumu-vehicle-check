using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Entities;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;

namespace Susumu.Api.Tests;

public sealed class AuthTests : ApiTestBase
{
    [Fact]
    public async Task Login_returns_token_offline_window_and_user()
    {
        var response = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", TestApp.Password, Device));

        var login = await response.ReadAsync<LoginResponse>();

        Assert.False(string.IsNullOrWhiteSpace(login.AccessToken));
        Assert.True(login.ExpiresAt > DateTimeOffset.UtcNow);
        // Contract: 12 h online token, 72 h offline drafting window measured from the same instant.
        Assert.Equal(TimeSpan.FromHours(60), login.OfflineUntil - login.ExpiresAt);
        Assert.Equal(UserRole.Inspector, login.User.Role);
        Assert.Equal("inspector", login.User.Username);
    }

    [Fact]
    public async Task Login_with_wrong_password_is_rejected_without_revealing_the_reason()
    {
        var response = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", "wrong-password", Device));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Equal("Invalid username or password.", problem.Detail);
    }

    [Fact]
    public async Task Login_for_unknown_user_returns_the_same_message_as_a_wrong_password()
    {
        var unknown = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("nobody", "wrong-password", Device));
        var wrong = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", "wrong-password", Device));

        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(
            (await wrong.ReadProblemAsync()).Detail,
            (await unknown.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task Inactive_account_cannot_sign_in()
    {
        var response = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inactive", TestApp.Password, Device));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_requires_a_device_id()
    {
        var response = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", TestApp.Password, "   "));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.True(problem.Errors!.ContainsKey("deviceId"));
    }

    [Fact]
    public async Task Repeated_failures_are_throttled_with_retry_after()
    {
        HttpResponseMessage? last = null;
        for (var attempt = 0; attempt < new LoginThrottleOptions().MaxAccountFailures + 1; attempt++)
        {
            last = await App.Anonymous.PostJsonAsync(
                "/api/v1/auth/login", new LoginRequest("inspector", "wrong-password", Device));
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
        Assert.True(last.Headers.Contains("Retry-After"));

        // The lockout must also block the correct password, otherwise it is not a lockout.
        var correct = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", TestApp.Password, Device));
        Assert.Equal(HttpStatusCode.TooManyRequests, correct.StatusCode);
    }

    [Fact]
    public async Task Failed_logins_are_audited()
    {
        await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", "wrong-password", Device));

        var audited = await App.WithDbAsync(db => db.AuditEntries
            .AnyAsync(a => a.Action == AuditActions.LoginFailed));

        Assert.True(audited);
    }

    [Fact]
    public async Task Protected_endpoints_reject_anonymous_callers_with_problem_details()
    {
        var response = await App.Anonymous.GetAsync("/api/v1/vehicles");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var problem = await response.ReadProblemAsync();
        Assert.Equal(401, problem.Status);
    }

    [Fact]
    public async Task Me_returns_the_authenticated_account()
    {
        var client = await App.SignInAsync("supervisor");

        var user = await (await client.GetAsync("/api/v1/auth/me")).ReadAsync<UserDto>();

        Assert.Equal(Fixture.SupervisorId, user.Id);
        Assert.Equal(UserRole.Supervisor, user.Role);
    }

    [Fact]
    public async Task Bootstrap_returns_scoped_vehicles_and_published_templates()
    {
        var client = await App.SignInAsync("inspector");

        var bootstrap = await (await client.GetAsync("/api/v1/bootstrap")).ReadAsync<BootstrapResponse>();

        Assert.Contains(bootstrap.Vehicles, v => v.Id == Fixture.TruckId);
        Assert.DoesNotContain(bootstrap.Vehicles, v => v.Id == Fixture.OtherLocationVehicleId);
        Assert.All(bootstrap.Templates, t => Assert.True(t.Published));
        Assert.Contains(bootstrap.Templates, t => t.Id == Fixture.TemplateId);
    }

    [Fact]
    public async Task Deactivating_an_account_invalidates_tokens_already_issued()
    {
        var client = await App.SignInAsync("inspector");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/auth/me")).StatusCode);

        var admin = await App.SignInAsync("admin");
        var deactivate = await admin.PutJsonAsync(
            $"/api/v1/users/{Fixture.InspectorId}", new UpdateUserRequest(null, null, false, null));
        deactivate.EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Changing_a_role_invalidates_tokens_already_issued()
    {
        var client = await App.SignInAsync("inspector");
        var admin = await App.SignInAsync("admin");

        var update = await admin.PutJsonAsync(
            $"/api/v1/users/{Fixture.InspectorId}", new UpdateUserRequest(null, UserRole.Office, null, null));
        update.EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Fact]
    public async Task A_token_signed_with_another_key_is_rejected()
    {
        using var scope = App.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SusumuDbContext>();
        var user = await db.Users.FirstAsync(u => u.Username == "inspector");

        var foreignOptions = Microsoft.Extensions.Options.Options.Create(new JwtOptions
        {
            SigningKey = "a-completely-different-signing-key-0123456789",
        });

        var forged = new TokenService(foreignOptions, new Susumu.Infrastructure.Time.SystemClock()).Issue(user, Device);

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", forged.Token);
        var response = await App.Anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_never_returns_the_password_hash()
    {
        var response = await App.Anonymous.PostJsonAsync(
            "/api/v1/auth/login", new LoginRequest("inspector", TestApp.Password, Device));

        var body = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain("passwordHash", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(TestApp.Password, body, StringComparison.Ordinal);
    }
}
