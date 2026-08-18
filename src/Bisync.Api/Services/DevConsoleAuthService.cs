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
                Position = "Super User",
                TeamType = "Management",
                AccessJson = DevConsoleTabAccess.AllTabsJson(),
                PasswordHash = AppPasswordHasher.Hash(SuperAdminAccess.SuperAdminPassword),
                Active = true,
                MustChangePassword = false,
                IsRoot = true,
                CreatedAt = DateTime.UtcNow,
                CreatedByEmail = "system",
            });
            await db.SaveChangesAsync(ct);
            await EnsureDefaultTeamPasswordsAsync(ct);
            return;
        }

        existing.IsRoot = true;
        existing.Active = true;
        existing.MustChangePassword = false;
        existing.Position = string.IsNullOrWhiteSpace(existing.Position) ? "Super User" : existing.Position;
        existing.TeamType = DevConsoleTabAccess.NormalizeTeamType(
            string.IsNullOrWhiteSpace(existing.TeamType) ? "Management" : existing.TeamType);
        existing.AccessJson = DevConsoleTabAccess.AllTabsJson();
        if (string.IsNullOrWhiteSpace(existing.PasswordHash))
            existing.PasswordHash = AppPasswordHasher.Hash(SuperAdminAccess.SuperAdminPassword);
        existing.InviteToken = null;
        existing.InviteTokenExpiresAt = null;
        existing.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        await EnsureDefaultTeamPasswordsAsync(ct);
    }

    /// <summary>
    /// Dev Console team members use Pass@123 until they change it on first login.
    /// </summary>
    public static string DefaultTeamPassword => SuperAdminAccess.DefaultBootstrapPassword;

    public void ApplyDefaultTeamPassword(DevTeamUser user)
    {
        if (user.IsRoot) return;
        user.PasswordHash = AppPasswordHasher.Hash(DefaultTeamPassword);
        user.MustChangePassword = true;
        user.Active = true;
        user.InviteToken = null;
        user.InviteTokenExpiresAt = null;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAt = null;
        user.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Ensure every non-root team member can sign in with Pass@123 and must change it on first login.
    /// Personal passwords are kept only after the member completed that required change.
    /// </summary>
    public async Task EnsureDefaultTeamPasswordsAsync(CancellationToken ct = default)
    {
        var members = await db.DevTeamUsers.Where(u => !u.IsRoot).ToListAsync(ct);
        var changed = false;
        foreach (var member in members)
        {
            var alreadyChangedToPersonal =
                member.HasPassword
                && !member.MustChangePassword
                && !member.InvitePending
                && !AppPasswordHasher.Verify(DefaultTeamPassword, member.PasswordHash);

            if (alreadyChangedToPersonal)
                continue;

            ApplyDefaultTeamPassword(member);
            changed = true;
        }

        if (changed)
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
        if (!user.HasPassword)
            return (null, "Account has no password yet. Ask the Super User to reset it to the default.");
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
                StringComparison.OrdinalIgnoreCase)
            || string.Equals(Environment.GetEnvironmentVariable("DEV_CONSOLE_ENABLED"), "true",
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

    public string IssueInviteToken(DevTeamUser user, int hoursValid = 72)
    {
        user.InviteToken = NewOpaqueToken();
        user.InviteTokenExpiresAt = DateTime.UtcNow.AddHours(Math.Clamp(hoursValid, 1, 168));
        user.UpdatedAt = DateTime.UtcNow;
        return user.InviteToken;
    }

    public string IssuePasswordResetToken(DevTeamUser user, int hoursValid = 24)
    {
        user.PasswordResetToken = NewOpaqueToken();
        user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(Math.Clamp(hoursValid, 1, 72));
        user.UpdatedAt = DateTime.UtcNow;
        return user.PasswordResetToken;
    }

    public async Task<(DevTeamUser? User, string? Error)> AcceptInviteAsync(
        string token,
        string newPassword,
        CancellationToken ct)
    {
        token = (token ?? "").Trim();
        if (string.IsNullOrWhiteSpace(token))
            return (null, "Invitation token is required.");
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            return (null, "Password must be at least 8 characters.");
        if (string.Equals(newPassword, DefaultTeamPassword, StringComparison.Ordinal))
            return (null, "Choose a password different from the default team password.");

        var user = await db.DevTeamUsers.FirstOrDefaultAsync(u => u.InviteToken == token, ct);
        if (user is null)
            return (null, "Invalid or expired invitation link.");
        if (user.InviteTokenExpiresAt is DateTime expires && expires < DateTime.UtcNow)
            return (null, "This invitation link has expired. Ask the Super User to resend it.");

        user.PasswordHash = AppPasswordHasher.Hash(newPassword);
        user.Active = true;
        user.MustChangePassword = false;
        user.InviteToken = null;
        user.InviteTokenExpiresAt = null;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAt = null;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return (user, null);
    }

    public async Task<(DevTeamUser? User, string? Error)> ResetPasswordAsync(
        string token,
        string newPassword,
        CancellationToken ct)
    {
        token = (token ?? "").Trim();
        if (string.IsNullOrWhiteSpace(token))
            return (null, "Reset token is required.");
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            return (null, "Password must be at least 8 characters.");
        if (string.Equals(newPassword, DefaultTeamPassword, StringComparison.Ordinal))
            return (null, "Choose a new password different from the default team password.");

        var user = await db.DevTeamUsers.FirstOrDefaultAsync(u => u.PasswordResetToken == token, ct);
        if (user is null)
            return (null, "Invalid or expired reset link.");
        if (user.PasswordResetTokenExpiresAt is DateTime expires && expires < DateTime.UtcNow)
            return (null, "This reset link has expired. Request a new one.");
        if (!user.Active)
            return (null, "Account is inactive.");

        user.PasswordHash = AppPasswordHasher.Hash(newPassword);
        user.MustChangePassword = false;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAt = null;
        user.InviteToken = null;
        user.InviteTokenExpiresAt = null;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return (user, null);
    }

    public async Task<(bool Ok, string? Error)> ChangePasswordAsync(
        DevTeamUser user,
        string currentPassword,
        string newPassword,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 8)
            return (false, "New password must be at least 8 characters.");
        if (!user.HasPassword || !AppPasswordHasher.Verify(currentPassword, user.PasswordHash))
            return (false, "Current password is incorrect.");
        if (string.Equals(newPassword, DefaultTeamPassword, StringComparison.Ordinal))
            return (false, "Choose a new password different from the default team password.");

        user.PasswordHash = AppPasswordHasher.Hash(newPassword);
        user.MustChangePassword = false;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return (true, null);
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
