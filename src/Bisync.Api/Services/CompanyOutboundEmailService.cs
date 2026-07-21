using System.Net;
using System.Net.Mail;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Company-scoped outbound SMTP (Purchase Order / vendor email).
/// Resolves Microsoft / Google / common providers automatically from the email address.
/// </summary>
public static class CompanyOutboundEmailService
{
    public sealed record SmtpSettings(
        string Host,
        int Port,
        bool UseSsl,
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
        bool UseSsl,
        string Tip);

    static readonly ProviderProfile Google = new(
        "google",
        "Google / Gmail",
        "smtp.gmail.com",
        587,
        true,
        "Google accounts with 2-Step Verification need an App Password (not your normal login password).");

    static readonly ProviderProfile Microsoft = new(
        "microsoft",
        "Microsoft 365 / Outlook",
        "smtp.office365.com",
        587,
        true,
        "Use your Microsoft 365 or Outlook email and password. If MFA is on, use an app password.");

    static readonly ProviderProfile Yahoo = new(
        "yahoo",
        "Yahoo Mail",
        "smtp.mail.yahoo.com",
        587,
        true,
        "Yahoo usually requires an app password generated in account security settings.");

    static readonly ProviderProfile Icloud = new(
        "icloud",
        "iCloud Mail",
        "smtp.mail.me.com",
        587,
        true,
        "iCloud requires an app-specific password from appleid.apple.com.");

    static readonly ProviderProfile Zoho = new(
        "zoho",
        "Zoho Mail",
        "smtp.zoho.com",
        587,
        true,
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

    /// <summary>Primary provider for an email address (consumer domains + business defaults).</summary>
    public static ProviderProfile ResolveProvider(string email)
    {
        var domain = GetDomain(email);
        if (domain is null) return Microsoft;

        if (GoogleDomains.Contains(domain) || domain.EndsWith(".google.com", StringComparison.OrdinalIgnoreCase))
            return Google;
        if (MicrosoftDomains.Contains(domain))
            return Microsoft;
        if (YahooDomains.Contains(domain) || domain.StartsWith("yahoo.", StringComparison.OrdinalIgnoreCase))
            return Yahoo;
        if (IcloudDomains.Contains(domain))
            return Icloud;
        if (ZohoDomains.Contains(domain) || domain.EndsWith(".zoho.com", StringComparison.OrdinalIgnoreCase))
            return Zoho;

        // Custom / company domains: Microsoft 365 (Exchange Online) is the common business default.
        return new ProviderProfile(
            "microsoft-business",
            "Microsoft Exchange / Microsoft 365",
            Microsoft.Host,
            Microsoft.Port,
            Microsoft.UseSsl,
            "Company domains usually send through Microsoft 365. If this mailbox is Google Workspace, the system will also try Google automatically when testing.");
    }

    /// <summary>Ordered SMTP candidates (primary first, then sensible fallbacks for custom domains).</summary>
    public static IReadOnlyList<ProviderProfile> ResolveCandidates(string email)
    {
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

        // Custom domains: also try Google Workspace and smtp.<domain>.
        if (domain is not null
            && !GoogleDomains.Contains(domain)
            && !MicrosoftDomains.Contains(domain)
            && !YahooDomains.Contains(domain)
            && !IcloudDomains.Contains(domain)
            && !ZohoDomains.Contains(domain))
        {
            AddUnique(Google with { Id = "google-workspace", Label = "Google Workspace" });
            AddUnique(new ProviderProfile(
                "domain-smtp",
                $"Mail server for {domain}",
                $"smtp.{domain}",
                587,
                true,
                "Tried the domain’s own SMTP host as a fallback."));
            AddUnique(new ProviderProfile(
                "domain-mail",
                $"Mail server for {domain}",
                $"mail.{domain}",
                587,
                true,
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
            provider.UseSsl,
            address,
            (password ?? string.Empty).Trim(),
            address,
            string.IsNullOrWhiteSpace(fromName) ? string.Empty : fromName.Trim(),
            provider.Id,
            provider.Label);
    }

    /// <summary>
    /// Fill company SMTP fields from outbound email + password.
    /// Host/port/SSL/username are derived automatically from the email provider.
    /// </summary>
    public static void ApplyAutoSmtp(Company target, string outboundEmail, string? passwordOrNullToKeep, string? fromName)
    {
        var email = (outboundEmail ?? string.Empty).Trim();
        if (!IsLikelyEmail(email))
        {
            target.SmtpFromEmail = email;
            target.SmtpUsername = email;
            if (!string.IsNullOrWhiteSpace(fromName))
                target.SmtpFromName = fromName.Trim();
            return;
        }

        var settings = BuildSettings(email, passwordOrNullToKeep ?? string.Empty, fromName);
        target.SmtpHost = settings.Host;
        target.SmtpPort = settings.Port;
        target.SmtpUseSsl = settings.UseSsl;
        target.SmtpUsername = settings.Username;
        target.SmtpFromEmail = settings.FromEmail;
        target.SmtpFromName = settings.FromName;
        if (passwordOrNullToKeep is not null)
            target.SmtpPassword = passwordOrNullToKeep.Trim();
    }

    public static SmtpSettings FromCompany(Company company, string? passwordOverride = null)
    {
        var email = !string.IsNullOrWhiteSpace(company.SmtpFromEmail)
            ? company.SmtpFromEmail.Trim()
            : (company.SmtpUsername ?? string.Empty).Trim();
        var password = string.IsNullOrWhiteSpace(passwordOverride)
            ? (company.SmtpPassword ?? string.Empty)
            : passwordOverride.Trim();

        // Prefer auto-resolved host when email is present (keeps provider mapping current).
        if (IsLikelyEmail(email))
            return BuildSettings(email, password, company.SmtpFromName);

        return new SmtpSettings(
            (company.SmtpHost ?? string.Empty).Trim(),
            company.SmtpPort is > 0 and <= 65535 ? company.SmtpPort : 587,
            company.SmtpUseSsl,
            (company.SmtpUsername ?? string.Empty).Trim(),
            password,
            (company.SmtpFromEmail ?? string.Empty).Trim(),
            (company.SmtpFromName ?? string.Empty).Trim(),
            "custom",
            "Custom SMTP");
    }

    /// <summary>Returns null when settings are complete enough to attempt a send.</summary>
    public static string? ValidateForSend(SmtpSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.FromEmail) || !IsLikelyEmail(settings.FromEmail))
            return "A valid outbound email address is required.";
        if (string.IsNullOrWhiteSpace(settings.Password))
            return "Email password is required.";
        if (string.IsNullOrWhiteSpace(settings.Host))
            return "Could not detect the mail server for this email address.";
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

        using var message = new MailMessage
        {
            From = new MailAddress(
                settings.FromEmail,
                string.IsNullOrWhiteSpace(settings.FromName) ? settings.FromEmail : settings.FromName),
            Subject = subject,
            Body = plainTextBody,
            IsBodyHtml = false,
        };
        message.To.Add(toEmail.Trim());

        using var client = new SmtpClient(settings.Host, settings.Port)
        {
            EnableSsl = settings.UseSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = false,
            Credentials = new NetworkCredential(settings.Username, settings.Password),
            Timeout = 30_000,
        };

        ct.ThrowIfCancellationRequested();
        await client.SendMailAsync(message);
    }

    /// <summary>
    /// Send using the primary provider, then fallbacks (Google Workspace / domain SMTP) for custom domains.
    /// Returns the provider that succeeded.
    /// </summary>
    public static async Task<(SmtpSettings Used, string ProviderLabel)> SendWithFallbackAsync(
        string outboundEmail,
        string password,
        string? fromName,
        string toEmail,
        string subject,
        string plainTextBody,
        CancellationToken ct = default)
    {
        var email = outboundEmail.Trim();
        var candidates = ResolveCandidates(email);
        Exception? last = null;

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
                last = ex;
            }
        }

        var detail = last?.InnerException?.Message ?? last?.Message ?? "Unknown SMTP error.";
        throw new InvalidOperationException($"Could not send email via detected mail servers. {detail}");
    }

    public static async Task<(SmtpSettings Used, string ProviderLabel)> SendTestAsync(
        string outboundEmail,
        string password,
        string? fromName,
        string toEmail,
        string companyName,
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
            ct);
    }
}
