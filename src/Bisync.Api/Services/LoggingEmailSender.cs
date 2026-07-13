namespace Bisync.Api.Services;

/// <summary>
/// Stub email sender until SMTP is configured. Logs the message for operators.
/// </summary>
public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string toEmail, string subject, string plainTextBody, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "Email (stub — SMTP not configured) To={To} Subject={Subject} Body={Body}",
            toEmail,
            subject,
            plainTextBody);
        return Task.CompletedTask;
    }
}
