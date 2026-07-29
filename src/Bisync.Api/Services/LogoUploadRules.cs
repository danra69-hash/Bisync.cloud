namespace Bisync.Api.Services;

/// <summary>Shared validation for company / location logo uploads (base64 in DB).</summary>
public static class LogoUploadRules
{
    /// <summary>~1 MB binary → ~1.4M base64 chars.</summary>
    public const int MaxLogoBase64Length = 1_500_000;

    static readonly HashSet<string> AllowedLogoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/gif",
        "image/svg+xml",
    };

    public static string? NormalizeAndValidate(
        string? fileNameIn,
        string? contentTypeIn,
        string? base64In,
        string entityLabel,
        out string fileName,
        out string contentType,
        out string base64)
    {
        fileName = (fileNameIn ?? string.Empty).Trim();
        contentType = (contentTypeIn ?? string.Empty).Trim().ToLowerInvariant();
        base64 = (base64In ?? string.Empty).Trim();

        // Accept data-URL payloads from the client and strip the prefix.
        if (base64.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var comma = base64.IndexOf(',');
            if (comma > 0)
            {
                var header = base64[..comma];
                base64 = base64[(comma + 1)..];
                var mimeStart = header.IndexOf(':');
                var mimeEnd = header.IndexOf(';');
                if (mimeStart >= 0 && mimeEnd > mimeStart && string.IsNullOrWhiteSpace(contentType))
                    contentType = header[(mimeStart + 1)..mimeEnd].Trim().ToLowerInvariant();
            }
        }

        if (string.IsNullOrWhiteSpace(base64))
        {
            fileName = string.Empty;
            contentType = string.Empty;
            base64 = string.Empty;
            return null;
        }

        if (base64.Length > MaxLogoBase64Length)
            return $"{entityLabel} logo is too large (max ~1 MB).";

        if (string.IsNullOrWhiteSpace(contentType))
            contentType = "image/png";
        if (contentType == "image/jpg")
            contentType = "image/jpeg";

        if (!AllowedLogoContentTypes.Contains(contentType))
            return $"{entityLabel} logo must be PNG, JPEG, WebP, GIF, or SVG.";

        if (fileName.Length > 260)
            fileName = fileName[..260];

        return null;
    }
}
