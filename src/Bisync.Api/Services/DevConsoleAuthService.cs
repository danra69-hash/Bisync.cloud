using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Bisync.Api.Services;

public class DevConsoleAuthService(
    BisyncDbContext db,
    IOptions<DevConsoleAuthOptions> options,
    IHttpClientFactory httpClientFactory,
    IWebHostEnvironment env)
{
    public const string TokenHeader = "X-Bisync-Dev-Console-Token";

    readonly DevConsoleAuthOptions _opts = options.Value;

    public IReadOnlyList<string> AllowedDomains =>
        _opts.AllowedEmailDomains
            .Select(d => d.Trim().TrimStart('@').ToLowerInvariant())
            .Where(d => d.Length > 0)
            .Distinct()
            .ToList();

    public string RootEmail => (_opts.RootEmail ?? SuperAdminAccess.SuperAdminEmail).Trim().ToLowerInvariant();

    public bool IsAllowedEmailDomain(string email)
    {
        var at = email.Trim().ToLowerInvariant().LastIndexOf('@');
        if (at < 0 || at == email.Length - 1) return false;
        var domain = email[(at + 1)..].Trim().ToLowerInvariant();
        return AllowedDomains.Contains(domain);
    }

    public async Task EnsureRootUserAsync(CancellationToken ct = default)
    {
        var rootEmail = RootEmail;
        var existing = await db.DevTeamUsers.FirstOrDefaultAsync(u => u.Email == rootEmail, ct);
        if (existing is null)
        {
            db.DevTeamUsers.Add(new DevTeamUser
            {
                Email = rootEmail,
                FullName = "DRA Super Admin",
                PasswordHash = AppPasswordHasher.Hash(SuperAdminAccess.SuperAdminPassword),
                Active = true,
                IsRoot = true,
                CreatedAt = DateTime.UtcNow,
                CreatedByEmail = "system",
            });
            await db.SaveChangesAsync(ct);
            return;
        }

        existing.IsRoot = true;
        existing.Active = true;
        if (string.IsNullOrWhiteSpace(existing.PasswordHash))
            existing.PasswordHash = AppPasswordHasher.Hash(SuperAdminAccess.SuperAdminPassword);
        existing.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<(DevConsolePasswordTicket? Ticket, string? Error)> CreatePasswordTicketAsync(
        string email,
        string password,
        CancellationToken ct)
    {
        email = email.Trim().ToLowerInvariant();
        if (!IsAllowedEmailDomain(email))
            return (null, $"Email must end with @{string.Join(" or @", AllowedDomains)}.");

        var user = await db.DevTeamUsers.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !user.Active)
            return (null, "Invalid email or password.");
        if (!AppPasswordHasher.Verify(password, user.PasswordHash))
            return (null, "Invalid email or password.");

        var ticket = new DevConsolePasswordTicket
        {
            Ticket = NewOpaqueToken(),
            DevTeamUserId = user.Id,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddMinutes(Math.Clamp(_opts.PasswordTicketMinutes, 2, 60)),
            Consumed = false,
        };
        db.DevConsolePasswordTickets.Add(ticket);
        await db.SaveChangesAsync(ct);
        await db.Entry(ticket).Reference(t => t.DevTeamUser).LoadAsync(ct);
        return (ticket, null);
    }

    public bool GoogleConfigured => !string.IsNullOrWhiteSpace(_opts.GoogleClientId);

    public bool CanSkipGoogle =>
        !GoogleConfigured
        && _opts.AllowPasswordOnlyWhenGoogleUnconfigured
        && (env.IsDevelopment()
            || string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development",
                StringComparison.OrdinalIgnoreCase));

    public async Task<(DevConsoleSession? Session, DevTeamUser? User, string? Error)> CompleteWithGoogleAsync(
        string ticketValue,
        string googleIdToken,
        CancellationToken ct)
    {
        var ticket = await db.DevConsolePasswordTickets
            .Include(t => t.DevTeamUser)
            .FirstOrDefaultAsync(t => t.Ticket == ticketValue, ct);
        if (ticket is null || ticket.Consumed || ticket.ExpiresAt < DateTime.UtcNow)
            return (null, null, "Password step expired. Sign in again.");
        if (ticket.DevTeamUser is null || !ticket.DevTeamUser.Active)
            return (null, null, "Account inactive.");

        var google = await VerifyGoogleIdTokenAsync(googleIdToken, ct);
        if (google is null)
            return (null, null, "Google Sign-In failed. Invalid or expired token.");
        if (!google.EmailVerified)
            return (null, null, "Google email is not verified.");

        var googleEmail = google.Email.Trim().ToLowerInvariant();
        if (!string.Equals(googleEmail, ticket.DevTeamUser.Email, StringComparison.OrdinalIgnoreCase))
            return (null, null, "Google account email must match the Dev Console email.");
        if (!IsAllowedEmailDomain(googleEmail))
            return (null, null, "Google email domain is not allowed.");

        ticket.Consumed = true;
        ticket.DevTeamUser.GoogleSubject = google.Subject;
        ticket.DevTeamUser.UpdatedAt = DateTime.UtcNow;

        var session = new DevConsoleSession
        {
            Token = NewOpaqueToken(),
            DevTeamUserId = ticket.DevTeamUserId,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(Math.Clamp(_opts.SessionHours, 1, 72)),
            GoogleEmail = googleEmail,
        };
        db.DevConsoleSessions.Add(session);
        await db.SaveChangesAsync(ct);
        return (session, ticket.DevTeamUser, null);
    }

    public async Task<(DevConsoleSession? Session, DevTeamUser? User, string? Error)> CompletePasswordOnlyAsync(
        string ticketValue,
        CancellationToken ct)
    {
        if (!CanSkipGoogle)
            return (null, null, "Google Sign-In is required. Configure DevConsole:GoogleClientId.");

        var ticket = await db.DevConsolePasswordTickets
            .Include(t => t.DevTeamUser)
            .FirstOrDefaultAsync(t => t.Ticket == ticketValue, ct);
        if (ticket is null || ticket.Consumed || ticket.ExpiresAt < DateTime.UtcNow)
            return (null, null, "Password step expired. Sign in again.");
        if (ticket.DevTeamUser is null || !ticket.DevTeamUser.Active)
            return (null, null, "Account inactive.");

        ticket.Consumed = true;
        var session = new DevConsoleSession
        {
            Token = NewOpaqueToken(),
            DevTeamUserId = ticket.DevTeamUserId,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(Math.Clamp(_opts.SessionHours, 1, 72)),
            GoogleEmail = ticket.DevTeamUser.Email,
        };
        db.DevConsoleSessions.Add(session);
        await db.SaveChangesAsync(ct);
        return (session, ticket.DevTeamUser, null);
    }

    public async Task<(DevTeamUser? User, DevConsoleSession? Session)> ResolveSessionAsync(
        string? token,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return (null, null);
        var session = await db.DevConsoleSessions
            .Include(s => s.DevTeamUser)
            .FirstOrDefaultAsync(s => s.Token == token, ct);
        if (session is null || session.ExpiresAt < DateTime.UtcNow)
            return (null, null);
        if (session.DevTeamUser is null || !session.DevTeamUser.Active)
            return (null, null);
        return (session.DevTeamUser, session);
    }

    public async Task RevokeSessionAsync(string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return;
        var session = await db.DevConsoleSessions.FirstOrDefaultAsync(s => s.Token == token, ct);
        if (session is null) return;
        db.DevConsoleSessions.Remove(session);
        await db.SaveChangesAsync(ct);
    }

    async Task<GoogleTokenInfo?> VerifyGoogleIdTokenAsync(string idToken, CancellationToken ct)
    {
        if (!GoogleConfigured) return null;
        var client = httpClientFactory.CreateClient("google-oauth");
        using var res = await client.GetAsync(
            $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}",
            ct);
        if (!res.IsSuccessStatusCode) return null;
        var info = await res.Content.ReadFromJsonAsync<GoogleTokenInfo>(cancellationToken: ct);
        if (info is null) return null;
        if (!string.Equals(info.Aud, _opts.GoogleClientId, StringComparison.Ordinal))
            return null;
        if (string.IsNullOrWhiteSpace(info.Email) || string.IsNullOrWhiteSpace(info.Sub))
            return null;
        return info;
    }

    static string NewOpaqueToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    sealed class GoogleTokenInfo
    {
        [JsonPropertyName("aud")]
        public string Aud { get; set; } = string.Empty;

        [JsonPropertyName("sub")]
        public string Sub { get; set; } = string.Empty;

        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [JsonPropertyName("email_verified")]
        public System.Text.Json.JsonElement EmailVerifiedElement { get; set; }

        [JsonIgnore]
        public bool EmailVerified =>
            EmailVerifiedElement.ValueKind == System.Text.Json.JsonValueKind.True
            || (EmailVerifiedElement.ValueKind == System.Text.Json.JsonValueKind.String
                && (string.Equals(EmailVerifiedElement.GetString(), "true", StringComparison.OrdinalIgnoreCase)
                    || EmailVerifiedElement.GetString() == "1"));

        [JsonIgnore]
        public string Subject => Sub;
    }
}
