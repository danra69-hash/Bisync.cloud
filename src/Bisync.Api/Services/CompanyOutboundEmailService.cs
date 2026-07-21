using Bisync.Api.Models;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Bisync.Api.Services;

/// <summary>
/// Company-scoped outbound SMTP (Purchase Order / vendor email).
/// Resolves Microsoft / Google / common providers from the email address, with an optional
/// provider-mode override (auto | microsoft | google | custom).
/// Uses MailKit (STARTTLS / SSL) — System.Net.Mail.SmtpClient is unreliable with modern providers.
/// </summary>
public static class CompanyOutboundEmailService
{
    public const string ModeAuto = "auto";
    public const string ModeMicrosoft = "microsoft";
    public const string ModeGoogle = "google";
    public const string ModeCustom = "custom";

    public sealed record SmtpSettings(
        string Host,
        int Port,
        SecureSocketOptions Security,
        string Username,
        string Password,
        string FromEmail,
        string FromName,
        string ProviderId,
        string ProviderLabel);

    public sealed record ProviderProfile(
        string Id,
        string Label,
        string Host,
        int Port,
        SecureSocketOptions Security,
        string Tip);

    const string MicrosoftAuthTip =
        "Microsoft 365 business mailboxes often reject password SMTP until Authenticated SMTP is enabled " +
        "for the mailbox (Exchange admin → mailbox → Manage email apps → Authenticated SMTP). " +
        "If Security Defaults / Conditional Access block basic auth, use an App Password (if allowed) " +
        "or switch to Custom SMTP with a relay (SendGrid / Amazon SES).";

    const string GoogleAuthTip =
        "Google rejected the login (error 5.7.8 BadCredentials). " +
        "Create a 16-character App Password: Google Account → Security → 2-Step Verification → App passwords. " +
        "Do not use the normal account password. Google Workspace admins may also need to allow SMTP access.";

    static readonly ProviderProfile GoogleStartTls = new(
        "google",
        "Google / Gmail",
        "smtp.gmail.com",
        587,
        SecureSocketOptions.StartTls,
        GoogleAuthTip);

    static readonly ProviderProfile GoogleSsl = new(
        "google-ssl",
        "Google / Gmail (SSL)",
        "smtp.gmail.com",
        465,
        SecureSocketOptions.SslOnConnect,
        GoogleAuthTip);

    static readonly ProviderProfile MicrosoftStartTls = new(
        "microsoft",
        "Microsoft 365 / Outlook",
        "smtp.office365.com",
        587,
        SecureSocketOptions.StartTls,
        MicrosoftAuthTip);

    static readonly ProviderProfile YahooStartTls = new(
        "yahoo",
        "Yahoo Mail",
        "smtp.mail.yahoo.com",
        587,
        SecureSocketOptions.StartTls,
        "Yahoo usually requires an app password from account security settings.");

    static readonly ProviderProfile IcloudStartTls = new(
        "icloud",
        "iCloud Mail",
        "smtp.mail.me.com",
        587,
        SecureSocketOptions.StartTls,
        "iCloud requires an app-specific password from appleid.apple.com.");

    static readonly ProviderProfile ZohoStartTls = new(
        "zoho",
        "Zoho Mail",
        "smtp.zoho.com",
        587,
        SecureSocketOptions.StartTls,
        "Use your Zoho email and password (or app password if MFA is enabled).");

    static readonly HashSet<string> GoogleDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "gmail.com", "googlemail.com",
    };

    static readonly HashSet<string> MicrosoftDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "outlook.com", "hotmail.com", "live.com", "msn.com", "office365.com",
        "outlook.office365.com",
    };

    static readonly HashSet<string> YahooDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "yahoo.com", "yahoo.co.uk", "yahoo.com.sg", "yahoo.com.my", "ymail.com", "rocketmail.com",
    };

    static readonly HashSet<string> IcloudDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "icloud.com", "me.com", "mac.com",
    };

    static readonly HashSet<string> ZohoDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "zoho.com", "zohomail.com",
    };

    public static bool IsLikelyEmail(string value)
    {
        var v = (value ?? string.Empty).Trim();
        if (v.Length < 5) return false;
        var at = v.IndexOf('@');
        return at > 0 && at < v.Length - 1 && v.Contains('.');
    }

    public static string? GetDomain(string email)
    {
        if (!IsLikelyEmail(email)) return null;
        var at = email.Trim().LastIndexOf('@');
        return at < 0 ? null : email.Trim()[(at + 1)..].ToLowerInvariant();
    }

    /// <summary>Normalize passwords (Google app passwords are often pasted with spaces).</summary>
    public static string NormalizePassword(string? password) =>
        (password ?? string.Empty).Trim().Replace(" ", "", StringComparison.Ordinal);

    public static string NormalizeProviderMode(string? mode)
    {
        var m = (mode ?? ModeAuto).Trim().ToLowerInvariant();
        return m switch
        {
            "microsoft" or "ms" or "m365" or "office365" or "exchange" => ModeMicrosoft,
            "google" or "gmail" or "workspace" => ModeGoogle,
            "custom" => ModeCustom,
            _ => ModeAuto,
        };
    }

    public static ProviderProfile ResolveProvider(string email)
    {
        var domain = GetDomain(email);
        if (domain is null) return MicrosoftStartTls;

        if (GoogleDomains.Contains(domain) || domain.EndsWith(".google.com", StringComparison.OrdinalIgnoreCase))
            return GoogleStartTls;
        if (MicrosoftDomains.Contains(domain))
            return MicrosoftStartTls;
        if (YahooDomains.Contains(domain) || domain.StartsWith("yahoo.", StringComparison.OrdinalIgnoreCase))
            return YahooStartTls;
        if (IcloudDomains.Contains(domain))
            return IcloudStartTls;
        if (ZohoDomains.Contains(domain) || domain.EndsWith(".zoho.com", StringComparison.OrdinalIgnoreCase))
            return ZohoStartTls;

        return new ProviderProfile(
            "microsoft-business",
            "Microsoft Exchange / Microsoft 365",
            MicrosoftStartTls.Host,
            MicrosoftStartTls.Port,
            MicrosoftStartTls.Security,
            MicrosoftAuthTip + " If this mailbox is Google Workspace, choose Google in Mail provider.");
    }

    public static ProviderProfile ResolveProviderForMode(string email, string? providerMode)
    {
        var mode = NormalizeProviderMode(providerMode);
        return mode switch
        {
            ModeMicrosoft => MicrosoftStartTls,
            ModeGoogle => GoogleStartTls with { Id = "google-workspace", Label = "Google Workspace" },
            ModeCustom => new ProviderProfile(
                "custom",
                "Custom SMTP",
                "",
                587,
                SecureSocketOptions.StartTls,
                "Enter the SMTP host from your mail provider or transactional email relay."),
            _ => ResolveProvider(email),
        };
    }

    public static IReadOnlyList<ProviderProfile> ResolveCandidates(
        string email,
        string? providerMode = null,
        string? customHost = null,
        int? customPort = null,
        bool? customUseSsl = null)
    {
        var mode = NormalizeProviderMode(providerMode);

        if (mode == ModeCustom)
        {
            var host = (customHost ?? string.Empty).Trim();
            var port = customPort is > 0 and <= 65535 ? customPort.Value : 587;
            var useSsl = customUseSsl ?? true;
            return
            [
                new ProviderProfile(
                    "custom",
                    "Custom SMTP",
                    host,
                    port,
                    useSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None,
                    "Custom SMTP host from your mail provider or relay."),
            ];
        }

        if (mode == ModeMicrosoft)
            return [MicrosoftStartTls];

        if (mode == ModeGoogle)
            return
            [
                GoogleStartTls with { Id = "google-workspace", Label = "Google Workspace" },
                GoogleSsl with { Id = "google-workspace-ssl", Label = "Google Workspace (SSL)" },
            ];

        var primary = ResolveProvider(email);
        var list = new List<ProviderProfile> { primary };
        var domain = GetDomain(email);

        void AddUnique(ProviderProfile p)
        {
            if (list.Any(x => string.Equals(x.Host, p.Host, StringComparison.OrdinalIgnoreCase)
                              && x.Port == p.Port))
                return;
            list.Add(p);
        }

        // Prefer 587 STARTTLS only for Microsoft — port 465 often times out from cloud hosts.
        if (primary.Host.Contains("gmail", StringComparison.OrdinalIgnoreCase))
            AddUnique(GoogleSsl);

        // Custom domains: also try Google Workspace + domain SMTP hosts.
        if (domain is not null
            && !GoogleDomains.Contains(domain)
            && !MicrosoftDomains.Contains(domain)
            && !YahooDomains.Contains(domain)
            && !IcloudDomains.Contains(domain)
            && !ZohoDomains.Contains(domain))
        {
            AddUnique(GoogleStartTls with { Id = "google-workspace", Label = "Google Workspace" });
            AddUnique(new ProviderProfile(
                "domain-smtp",
                $"Mail server for {domain}",
                $"smtp.{domain}",
                587,
                SecureSocketOptions.StartTls,
                "Tried the domain’s own SMTP host as a fallback."));
            AddUnique(new ProviderProfile(
                "domain-mail",
                $"Mail server for {domain}",
                $"mail.{domain}",
                587,
                SecureSocketOptions.StartTls,
                "Tried mail.<domain> as a fallback."));
        }

        return list;
    }

    public static SmtpSettings BuildSettings(
        string email,
        string password,
        string? fromName = null,
        ProviderProfile? profile = null)
    {
        var address = (email ?? string.Empty).Trim();
        var provider = profile ?? ResolveProvider(address);
        return new SmtpSettings(
            provider.Host,
            provider.Port,
            provider.Security,
            address,
            NormalizePassword(password),
            address,
            string.IsNullOrWhiteSpace(fromName) ? string.Empty : fromName.Trim(),
            provider.Id,
            provider.Label);
    }

    public static void ApplyAutoSmtp(
        Company target,
        string outboundEmail,
        string? passwordOrNullToKeep,
        string? fromName,
        string? providerMode = null,
        string? customHost = null,
        int? customPort = null,
        bool? customUseSsl = null)
    {
        var email = (outboundEmail ?? string.Empty).Trim();
        var mode = NormalizeProviderMode(providerMode ?? target.SmtpProviderMode);
        target.SmtpProviderMode = mode;

        if (!IsLikelyEmail(email))
        {
            target.SmtpFromEmail = email;
            target.SmtpUsername = email;
            if (!string.IsNullOrWhiteSpace(fromName))
                target.SmtpFromName = fromName.Trim();
            if (passwordOrNullToKeep is not null)
                target.SmtpPassword = NormalizePassword(passwordOrNullToKeep);
            return;
        }

        if (mode == ModeCustom)
        {
            target.SmtpFromEmail = email;
            target.SmtpUsername = email;
            target.SmtpFromName = string.IsNullOrWhiteSpace(fromName) ? target.SmtpFromName : fromName.Trim();
            var host = (customHost ?? target.SmtpHost ?? string.Empty).Trim();
            target.SmtpHost = host;
            target.SmtpPort = customPort is > 0 and <= 65535 ? customPort.Value
                : target.SmtpPort is > 0 and <= 65535 ? target.SmtpPort : 587;
            target.SmtpUseSsl = customUseSsl ?? target.SmtpUseSsl;
            if (passwordOrNullToKeep is not null)
                target.SmtpPassword = NormalizePassword(passwordOrNullToKeep);
            return;
        }

        var profile = mode switch
        {
            ModeMicrosoft => MicrosoftStartTls,
            ModeGoogle => GoogleStartTls,
            _ => ResolveProvider(email),
        };
        var settings = BuildSettings(email, passwordOrNullToKeep ?? string.Empty, fromName, profile);
        target.SmtpHost = settings.Host;
        target.SmtpPort = settings.Port;
        target.SmtpUseSsl = settings.Security is SecureSocketOptions.StartTls or SecureSocketOptions.SslOnConnect;
        target.SmtpUsername = settings.Username;
        target.SmtpFromEmail = settings.FromEmail;
        target.SmtpFromName = settings.FromName;
        if (passwordOrNullToKeep is not null)
            target.SmtpPassword = NormalizePassword(passwordOrNullToKeep);
    }

    public static SmtpSettings FromCompany(Company company, string? passwordOverride = null)
    {
        var email = !string.IsNullOrWhiteSpace(company.SmtpFromEmail)
            ? company.SmtpFromEmail.Trim()
            : (company.SmtpUsername ?? string.Empty).Trim();
        var password = string.IsNullOrWhiteSpace(passwordOverride)
            ? (company.SmtpPassword ?? string.Empty)
            : passwordOverride;
        var mode = NormalizeProviderMode(company.SmtpProviderMode);

        // Prefer the last working / explicitly saved host (esp. custom + successful tests).
        if (!string.IsNullOrWhiteSpace(company.SmtpHost) && IsLikelyEmail(email))
        {
            return new SmtpSettings(
                company.SmtpHost.Trim(),
                company.SmtpPort is > 0 and <= 65535 ? company.SmtpPort : 587,
                company.SmtpUseSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None,
                string.IsNullOrWhiteSpace(company.SmtpUsername) ? email : company.SmtpUsername.Trim(),
                NormalizePassword(password),
                email,
                (company.SmtpFromName ?? string.Empty).Trim(),
                mode == ModeCustom ? "custom" : mode,
                mode == ModeCustom ? "Custom SMTP" : ResolveProviderForMode(email, mode).Label);
        }

        if (IsLikelyEmail(email))
        {
            var profile = ResolveProviderForMode(email, mode);
            if (mode == ModeCustom)
            {
                return new SmtpSettings(
                    (company.SmtpHost ?? string.Empty).Trim(),
                    company.SmtpPort is > 0 and <= 65535 ? company.SmtpPort : 587,
                    company.SmtpUseSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None,
                    email,
                    NormalizePassword(password),
                    email,
                    (company.SmtpFromName ?? string.Empty).Trim(),
                    "custom",
                    "Custom SMTP");
            }

            return BuildSettings(email, password, company.SmtpFromName, profile);
        }

        return new SmtpSettings(
            (company.SmtpHost ?? string.Empty).Trim(),
            company.SmtpPort is > 0 and <= 65535 ? company.SmtpPort : 587,
            company.SmtpUseSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None,
            (company.SmtpUsername ?? string.Empty).Trim(),
            NormalizePassword(password),
            (company.SmtpFromEmail ?? string.Empty).Trim(),
            (company.SmtpFromName ?? string.Empty).Trim(),
            "custom",
            "Custom SMTP");
    }

    public static string? ValidateForSend(SmtpSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.FromEmail) || !IsLikelyEmail(settings.FromEmail))
            return "A valid outbound email address is required.";
        if (string.IsNullOrWhiteSpace(settings.Password))
            return "Email password is required.";
        if (string.IsNullOrWhiteSpace(settings.Host))
            return "Could not detect the mail server for this email address. Choose a mail provider or enter a custom SMTP host.";
        if (settings.Port is < 1 or > 65535)
            return "SMTP port is invalid.";
        return null;
    }

    public static async Task SendAsync(
        SmtpSettings settings,
        string toEmail,
        string subject,
        string plainTextBody,
        CancellationToken ct = default)
    {
        var validation = ValidateForSend(settings);
        if (validation is not null)
            throw new InvalidOperationException(validation);
        if (!IsLikelyEmail(toEmail))
            throw new InvalidOperationException("A valid recipient email is required.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(
            string.IsNullOrWhiteSpace(settings.FromName) ? settings.FromEmail : settings.FromName,
            settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail.Trim()));
        message.Subject = subject;
        message.Body = new TextPart("plain")
        {
            Text = plainTextBody,
        };

        // Keep attempts short so multi-provider fallback stays responsive.
        using var client = new SmtpClient { Timeout = 15_000 };
        try
        {
            await client.ConnectAsync(settings.Host, settings.Port, settings.Security, ct);
            await client.AuthenticateAsync(settings.Username, settings.Password, ct);
            await client.SendAsync(message, ct);
        }
        finally
        {
            if (client.IsConnected)
                await client.DisconnectAsync(true, ct);
        }
    }

    public static async Task<(SmtpSettings Used, string ProviderLabel)> SendWithFallbackAsync(
        string outboundEmail,
        string password,
        string? fromName,
        string toEmail,
        string subject,
        string plainTextBody,
        string? providerMode = null,
        string? customHost = null,
        int? customPort = null,
        bool? customUseSsl = null,
        CancellationToken ct = default)
    {
        var email = outboundEmail.Trim();
        var mode = NormalizeProviderMode(providerMode);
        var candidates = ResolveCandidates(email, mode, customHost, customPort, customUseSsl);
        var errors = new List<string>();

        if (mode == ModeCustom && string.IsNullOrWhiteSpace(customHost))
            throw new InvalidOperationException("Custom SMTP requires a host (for example smtp.sendgrid.net).");

        foreach (var profile in candidates)
        {
            var settings = BuildSettings(email, password, fromName, profile);
            try
            {
                await SendAsync(settings, toEmail, subject, plainTextBody, ct);
                return (settings, profile.Label);
            }
            catch (Exception ex)
            {
                var detail = FormatSmtpError(ex, profile);
                errors.Add($"{profile.Label} ({profile.Host}:{profile.Port}): {detail}");
            }
        }

        var tip = BuildFailureTip(email, mode, errors);
        var joined = string.Join(" | ", errors.Take(2));
        throw new InvalidOperationException(
            $"Could not send email. Next step: {tip} — Details: {joined}");
    }

    static string BuildFailureTip(string email, string mode, IReadOnlyList<string> errors)
    {
        mode = NormalizeProviderMode(mode);
        if (mode == ModeGoogle) return GoogleAuthTip;
        if (mode == ModeMicrosoft) return MicrosoftAuthTip;
        if (mode == ModeCustom)
        {
            return "Check the custom SMTP host, port, and password/API key from your mail relay provider.";
        }

        var blob = string.Join(" ", errors);
        var googleHit = blob.Contains("gmail", StringComparison.OrdinalIgnoreCase)
            || blob.Contains("Google", StringComparison.OrdinalIgnoreCase)
            || blob.Contains("gsmtp", StringComparison.OrdinalIgnoreCase);
        var microsoftHit = blob.Contains("office365", StringComparison.OrdinalIgnoreCase)
            || blob.Contains("Microsoft", StringComparison.OrdinalIgnoreCase);

        if (googleHit && microsoftHit)
        {
            return "Both Microsoft 365 and Google rejected this password. Set Mail provider to the correct one for this mailbox — "
                + "Microsoft 365: enable Authenticated SMTP (or App Password). "
                + "Google Workspace: use a 16-character App Password, not the normal login password.";
        }

        if (googleHit) return GoogleAuthTip;
        if (microsoftHit) return MicrosoftAuthTip;
        return ResolveProvider(email).Tip;
    }

    static string FormatSmtpError(Exception ex, ProviderProfile? profile = null)
    {
        var msg = ex.InnerException?.Message ?? ex.Message;
        if (string.IsNullOrWhiteSpace(msg)) msg = ex.GetType().Name;

        var isGoogle = profile?.Host.Contains("gmail", StringComparison.OrdinalIgnoreCase) == true
            || msg.Contains("gsmtp", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("support.google.com/mail", StringComparison.OrdinalIgnoreCase);
        var isMicrosoft = profile?.Host.Contains("office365", StringComparison.OrdinalIgnoreCase) == true
            || msg.Contains("5.7.57", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("5.7.3", StringComparison.OrdinalIgnoreCase);

        // Soften common provider errors into actionable text.
        if (msg.Contains("Authentication", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("535", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("5.7.3", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("5.7.57", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("5.7.8", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("BadCredentials", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("Invalid credentials", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("Username and Password not accepted", StringComparison.OrdinalIgnoreCase))
        {
            if (isGoogle)
                return "Google rejected the password (need a 16-character App Password if 2-Step Verification is on)";
            if (isMicrosoft)
                return "Microsoft rejected the password (enable Authenticated SMTP on the mailbox, or use an App Password)";
            return "authentication failed (wrong password, or SMTP AUTH / App Password not enabled)";
        }

        if (msg.Contains("timed out", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("Timeout", StringComparison.OrdinalIgnoreCase))
        {
            return "connection timed out";
        }

        return msg.Length > 160 ? msg[..160] + "…" : msg;
    }

    public static async Task<(SmtpSettings Used, string ProviderLabel)> SendTestAsync(
        string outboundEmail,
        string password,
        string? fromName,
        string toEmail,
        string companyName,
        string? providerMode = null,
        string? customHost = null,
        int? customPort = null,
        bool? customUseSsl = null,
        CancellationToken ct = default)
    {
        var name = string.IsNullOrWhiteSpace(companyName) ? "your company" : companyName.Trim();
        return await SendWithFallbackAsync(
            outboundEmail,
            password,
            fromName,
            toEmail,
            subject: $"Bisync.cloud outbound email test — {name}",
            plainTextBody:
                $"This is a test message from Bisync.cloud for {name}.\n\n" +
                "If you received this, outbound email is configured correctly and can be used to email purchase orders to vendors.\n\n" +
                $"Sent at {DateTime.UtcNow:u} UTC.",
            providerMode,
            customHost,
            customPort,
            customUseSsl,
            ct);
    }
}
