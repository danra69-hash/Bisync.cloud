

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Bisync.Api.Models;
using Microsoft.IdentityModel.Tokens;

namespace Bisync.Api.Auth;

public sealed class TenantAuthOptions
{
    public const string Section = "Auth";

    /// <summary>HMAC signing key. Injected as Auth__SigningKey from Secrets Manager in production.</summary>
    public string SigningKey { get; set; } = string.Empty;

    public string Issuer { get; set; } = "bisync.ai";
    public string Audience { get; set; } = "bisync.ai";

    /// <summary>Matches the Dev Console session length so the two feel the same to operators.</summary>
    public int TokenHours { get; set; } = 12;

    /// <summary>
    /// Transition switch. While true, TenantContextMiddleware still accepts the legacy
    /// X-Bisync-User-Id / X-Bisync-Company-Id headers for requests that carry no token.
    /// Set false once every client (web SPA, Attendance app, desktop shell, POS devices)
    /// sends a bearer token.
    /// </summary>
    public bool AllowLegacyHeaders { get; set; } = true;
}

public interface ITenantTokenService
{
    string Issue(AppUser user);
}

public sealed class TenantTokenService(
    Microsoft.Extensions.Options.IOptions<TenantAuthOptions> options) : ITenantTokenService
{
    readonly TenantAuthOptions opts = options.Value;

    public string Issue(AppUser user)
    {
        if (string.IsNullOrWhiteSpace(opts.SigningKey) || opts.SigningKey.Length < 32)
        {
            throw new InvalidOperationException(
                "Auth:SigningKey is missing or shorter than 32 characters. " +
                "Set Auth__SigningKey from Secrets Manager before issuing tokens.");
        }

        var isPlatformAdmin = BisyncRoles.IsPlatformAdminRole(user.Role);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(BisyncRoles.RoleClaim, user.Role ?? string.Empty),
            new(BisyncRoles.PlatformAdminClaim, isPlatformAdmin ? "1" : "0"),
        };

        // A non-admin's company is fixed at issue time and cannot be overridden by a header.
        if (user.CompanyId is > 0)
            claims.Add(new Claim(BisyncRoles.CompanyClaim, user.CompanyId.Value.ToString()));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(opts.SigningKey));
        var token = new JwtSecurityToken(
            issuer: opts.Issuer,
            audience: opts.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddHours(Math.Clamp(opts.TokenHours, 1, 24)),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
