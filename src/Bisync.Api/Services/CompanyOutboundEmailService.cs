using System.Net;
using System.Net.Mail;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Company-scoped outbound SMTP (Purchase Order / vendor email).
/// Separate from platform <see cref="IEmailSender"/> (registration stub).
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
        string FromName);

    public static SmtpSettings FromCompany(Company company, string? passwordOverride = null) =>
        new(
            (company.SmtpHost ?? string.Empty).Trim(),
            company.SmtpPort is > 0 and <= 65535 ? company.SmtpPort : 587,
            company.SmtpUseSsl,
            (company.SmtpUsername ?? string.Empty).Trim(),
            string.IsNullOrWhiteSpace(passwordOverride)
                ? (company.SmtpPassword ?? string.Empty)
                : passwordOverride.Trim(),
            (company.SmtpFromEmail ?? string.Empty).Trim(),
            (company.SmtpFromName ?? string.Empty).Trim());

    /// <summary>Returns null when settings are complete enough to attempt a send.</summary>
    public static string? ValidateForSend(SmtpSettings settings)
    {
        if (string.IsNullOrWhiteSpace(settings.Host))
            return "SMTP host is required.";
        if (settings.Port is < 1 or > 65535)
            return "SMTP port must be between 1 and 65535.";
        if (string.IsNullOrWhiteSpace(settings.FromEmail) || !IsLikelyEmail(settings.FromEmail))
            return "A valid From email is required.";
        if (string.IsNullOrWhiteSpace(settings.Username))
            return "SMTP username is required.";
        if (string.IsNullOrWhiteSpace(settings.Password))
            return "SMTP password is required.";
        return null;
    }

    public static bool IsLikelyEmail(string value)
    {
        var v = (value ?? string.Empty).Trim();
        if (v.Length < 5) return false;
        var at = v.IndexOf('@');
        return at > 0 && at < v.Length - 1 && v.Contains('.');
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

        // SmtpClient.SendMailAsync does not accept CancellationToken on all TFMs.
        ct.ThrowIfCancellationRequested();
        await client.SendMailAsync(message);
    }

    public static async Task SendTestAsync(
        SmtpSettings settings,
        string toEmail,
        string companyName,
        CancellationToken ct = default)
    {
        var name = string.IsNullOrWhiteSpace(companyName) ? "your company" : companyName.Trim();
        await SendAsync(
            settings,
            toEmail,
            subject: $"Bisync.cloud outbound email test — {name}",
            plainTextBody:
                $"This is a test message from Bisync.cloud for {name}.\n\n" +
                "If you received this, outbound SMTP is configured correctly and can be used to email purchase orders to vendors.\n\n" +
                $"Sent at {DateTime.UtcNow:u} UTC.",
            ct);
    }
}
