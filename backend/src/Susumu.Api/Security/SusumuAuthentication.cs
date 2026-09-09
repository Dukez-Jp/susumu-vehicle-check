using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Susumu.Domain;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;

namespace Susumu.Api.Security;

public static class SusumuAuthentication
{
    public const string PolicyAdministrator = "susumu.administrator";
    public const string PolicyReviewer = "susumu.reviewer";
    public const string PolicyInspector = "susumu.inspector";

    private const string CurrentUserItemKey = "susumu.current-user";

    public static void AddSusumuAuthentication(this IServiceCollection services, JwtOptions jwt)
    {
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                    NameClaimType = SusumuClaims.Name,
                    RoleClaimType = SusumuClaims.Role,
                };

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = ResolveAndVerifyUserAsync,
                };
            });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build())
            .AddPolicy(PolicyAdministrator, policy => policy.RequireRole(nameof(UserRole.Administrator)))
            .AddPolicy(PolicyReviewer, policy => policy.RequireRole(
                nameof(UserRole.Administrator), nameof(UserRole.Supervisor)))
            .AddPolicy(PolicyInspector, policy => policy.RequireRole(
                nameof(UserRole.Administrator), nameof(UserRole.Supervisor), nameof(UserRole.Inspector)));
    }

    /// <summary>
    /// A valid signature is not enough: the account is re-read on every request so deactivation, role
    /// changes and password resets take effect immediately instead of at token expiry.
    /// </summary>
    private static async Task ResolveAndVerifyUserAsync(TokenValidatedContext context)
    {
        var principal = context.Principal;
        var userIdClaim = principal?.FindFirst(SusumuClaims.UserId)?.Value;
        var stampClaim = principal?.FindFirst(SusumuClaims.SecurityStamp)?.Value;

        if (!Guid.TryParse(userIdClaim, out var userId) || string.IsNullOrEmpty(stampClaim))
        {
            context.Fail("Token is missing the subject or security stamp.");
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<SusumuDbContext>();
        var user = await db.Users.AsNoTracking()
            .Include(u => u.Company)
            .Include(u => u.Location)
            .FirstOrDefaultAsync(u => u.Id == userId, context.HttpContext.RequestAborted);

        // The company and the location gate access too, so disabling a workshop takes effect at once
        // without having to touch every account that belongs to it.
        if (user is null || !user.Active || user.Company is not { Active: true } || user.Location is not { Active: true })
        {
            context.Fail("The account, its company or its location is no longer active.");
            return;
        }

        if (!string.Equals(user.SecurityStamp, stampClaim, StringComparison.Ordinal))
        {
            context.Fail("The account changed after this token was issued; sign in again.");
            return;
        }

        context.HttpContext.Items[CurrentUserItemKey] = new CurrentUser(
            user.Id, user.CompanyId, user.LocationId, user.Role, user.Name, user.Username);
    }

    /// <summary>Never returns client-supplied identity: the value was rebuilt from the database.</summary>
    public static CurrentUser CurrentUser(this HttpContext context)
        => context.Items[CurrentUserItemKey] as CurrentUser
           ?? throw AppException.Unauthorized("Authentication required.");

    public static string? TokenDeviceId(this HttpContext context)
        => context.User.FindFirst(SusumuClaims.DeviceId)?.Value;

    /// <summary>
    /// Throttling key for anonymous callers. This is the connection address after the forwarded
    /// headers middleware has run, which only rewrites it for proxies explicitly listed in
    /// <c>Network:TrustedProxies</c>; an arbitrary X-Forwarded-For header is never trusted.
    /// </summary>
    public static string ClientKey(this HttpContext context)
        => context.Connection.RemoteIpAddress?.ToString() ?? "unknown-client";
}
