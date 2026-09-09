using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Security;

public interface ITokenService
{
    (string Token, DateTimeOffset ExpiresAt, DateTimeOffset OfflineUntil) Issue(AppUser user, string deviceId);
}

public sealed class TokenService(IOptions<JwtOptions> options, IClock clock) : ITokenService
{
    private readonly JwtOptions _options = options.Value;

    public (string Token, DateTimeOffset ExpiresAt, DateTimeOffset OfflineUntil) Issue(AppUser user, string deviceId)
    {
        var now = clock.UtcNow;
        var expiresAt = now.Add(_options.AccessTokenLifetime);
        var offlineUntil = now.Add(_options.OfflineWindow);

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
            Subject = new ClaimsIdentity(
            [
                new Claim(SusumuClaims.UserId, user.Id.ToString()),
                new Claim(SusumuClaims.Username, user.Username),
                new Claim(SusumuClaims.Name, user.Name),
                new Claim(SusumuClaims.Role, user.Role.ToString()),
                new Claim(SusumuClaims.CompanyId, user.CompanyId.ToString()),
                new Claim(SusumuClaims.LocationId, user.LocationId.ToString()),
                new Claim(SusumuClaims.DeviceId, deviceId),
                new Claim(SusumuClaims.SecurityStamp, user.SecurityStamp),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            ]),
        };

        var token = new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false }.CreateToken(descriptor);
        return (token, expiresAt, offlineUntil);
    }
}
