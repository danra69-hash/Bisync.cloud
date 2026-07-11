using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace Bisync.Api.Services;

public sealed record CloudShareDownload(Stream Content, string FileName, string Provider);

/// <summary>
/// Downloads a publicly shared CSV (or .csv.gz) from Google Drive or Microsoft OneDrive / SharePoint.
/// Used by Independent Audit so large ledgers bypass Cloud Run's ~32 MB request body limit.
/// </summary>
public sealed class CloudShareFileDownloader(IHttpClientFactory httpClientFactory, ILogger<CloudShareFileDownloader> logger)
{
    public const long MaxBytes = 512L * 1024 * 1024;
    public const string HttpClientName = "CloudShareDownload";

    static readonly Regex DriveFileId =
        new(@"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:[^#]*&)?id=)([a-zA-Z0-9_-]+)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

    static readonly Regex DriveIdQuery =
        new(@"[?&]id=([a-zA-Z0-9_-]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    static readonly Regex DocsSpreadsheetId =
        new(@"docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]+)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

    static readonly Regex DriveConfirm =
        new(@"confirm=([0-9A-Za-z_-]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    static readonly Regex DriveConfirmForm =
        new(@"name=""confirm""\s+value=""([^""]+)""", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public async Task<CloudShareDownload> DownloadAsync(string shareUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(shareUrl))
            throw new InvalidOperationException("Share link is required.");

        if (!Uri.TryCreate(shareUrl.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            throw new InvalidOperationException("Share link must be an http(s) URL.");
        }

        var host = uri.Host.ToLowerInvariant();
        if (IsGoogleHost(host))
            return await DownloadGoogleAsync(uri, cancellationToken);
        if (IsMicrosoftHost(host))
            return await DownloadMicrosoftAsync(uri, cancellationToken);

        throw new InvalidOperationException(
            "Unsupported link. Paste a Google Drive or Microsoft OneDrive / SharePoint / Office 365 sharing URL "
            + "(Anyone with the link can view).");
    }

    static bool IsGoogleHost(string host) =>
        host is "drive.google.com" or "docs.google.com" or "www.drive.google.com";

    static bool IsMicrosoftHost(string host) =>
        host is "1drv.ms" or "onedrive.live.com"
        || host.EndsWith(".sharepoint.com", StringComparison.Ordinal)
        || host.EndsWith(".sharepoint-df.com", StringComparison.Ordinal)
        || host.Contains("onedrive", StringComparison.Ordinal);

    async Task<CloudShareDownload> DownloadGoogleAsync(Uri shareUri, CancellationToken cancellationToken)
    {
        using var http = CreateCookieClient();

        var sheets = DocsSpreadsheetId.Match(shareUri.AbsoluteUri);
        if (sheets.Success)
        {
            var exportUrl = $"https://docs.google.com/spreadsheets/d/{sheets.Groups[1].Value}/export?format=csv";
            var (stream, name) = await DownloadToTempAsync(http, new Uri(exportUrl), "spreadsheet.csv", cancellationToken);
            return new CloudShareDownload(stream, EnsureCsvName(name), "Google Sheets");
        }

        var id = ExtractDriveFileId(shareUri.AbsoluteUri)
            ?? throw new InvalidOperationException(
                "Could not read the Google Drive file id from that link. Use Share → Anyone with the link → Copy link.");

        var downloadUri = new Uri($"https://drive.google.com/uc?export=download&id={id}");
        using var first = await SendAsync(http, downloadUri, cancellationToken);
        var contentType = first.Content.Headers.ContentType?.MediaType ?? "";
        var dispositionName = first.Content.Headers.ContentDisposition?.FileName
            ?? first.Content.Headers.ContentDisposition?.FileNameStar;

        if (IsHtmlResponse(contentType, dispositionName))
        {
            var html = await first.Content.ReadAsStringAsync(cancellationToken);
            if (html.Contains("accounts.google.com", StringComparison.OrdinalIgnoreCase)
                || (html.Contains("Sign in", StringComparison.OrdinalIgnoreCase)
                    && html.Contains("Google Drive", StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException(
                    "Google Drive file is not publicly accessible. Set sharing to Anyone with the link (Viewer), then retry.");
            }

            var confirm = DriveConfirmForm.Match(html) is { Success: true } m1
                ? m1.Groups[1].Value
                : DriveConfirm.Match(html) is { Success: true } m2
                    ? m2.Groups[1].Value
                    : "t";

            var confirmed = new Uri(
                $"https://drive.google.com/uc?export=download&confirm={Uri.EscapeDataString(confirm)}&id={id}");
            var (stream, name) = await DownloadToTempAsync(http, confirmed, $"drive-{id}.csv", cancellationToken);
            return new CloudShareDownload(stream, EnsureCsvName(name), "Google Drive");
        }

        await using var body = await first.Content.ReadAsStreamAsync(cancellationToken);
        var fileName = ResolveFileName(first, $"drive-{id}.csv");
        var temp = await CopyToTempFileAsync(body, cancellationToken);
        return new CloudShareDownload(temp, EnsureCsvName(fileName), "Google Drive");
    }

    async Task<CloudShareDownload> DownloadMicrosoftAsync(Uri shareUri, CancellationToken cancellationToken)
    {
        var http = httpClientFactory.CreateClient(HttpClientName);
        var resolved = await ResolveRedirectsAsync(http, shareUri, cancellationToken);
        var encoded = EncodeSharingUrl(resolved.AbsoluteUri);
        var contentUri = new Uri($"https://api.onedrive.com/v1.0/shares/{encoded}/root/content");

        try
        {
            var (stream, name) = await DownloadToTempAsync(http, contentUri, "onedrive.csv", cancellationToken);
            return new CloudShareDownload(stream, EnsureCsvName(name), "OneDrive / SharePoint");
        }
        catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException)
        {
            logger.LogWarning(ex, "OneDrive shares API failed for {Url}", resolved);
            throw new InvalidOperationException(
                "Could not download from that Microsoft link. Share the file as Anyone with the link "
                + "(or people in your organization can view) and paste the OneDrive / SharePoint / 1drv.ms URL.",
                ex);
        }
    }

    HttpClient CreateCookieClient()
    {
        var handler = new HttpClientHandler
        {
            AllowAutoRedirect = true,
            UseCookies = true,
            CookieContainer = new CookieContainer(),
            AutomaticDecompression = DecompressionMethods.All,
        };
        var client = new HttpClient(handler) { Timeout = TimeSpan.FromMinutes(10) };
        return client;
    }

    async Task<(Stream Stream, string FileName)> DownloadToTempAsync(
        HttpClient http,
        Uri uri,
        string fallbackName,
        CancellationToken cancellationToken)
    {
        using var response = await SendAsync(http, uri, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var snippet = await SafeReadSnippetAsync(response, cancellationToken);
            throw new InvalidOperationException(
                $"Download failed ({(int)response.StatusCode}). Ensure the link allows viewing without sign-in. {snippet}");
        }

        var fileName = ResolveFileName(response, fallbackName);
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "";
        if (IsHtmlResponse(contentType, fileName))
        {
            throw new InvalidOperationException(
                "The share link returned a web page instead of a file. Check that the link is public and points to a .csv file.");
        }

        await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
        var temp = await CopyToTempFileAsync(body, cancellationToken);
        return (temp, fileName);
    }

    static async Task<HttpResponseMessage> SendAsync(HttpClient http, Uri uri, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        request.Headers.TryAddWithoutValidation(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        request.Headers.TryAddWithoutValidation("Accept", "*/*");

        var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            response.Dispose();
            throw new InvalidOperationException(
                "Access denied. Share the file so Anyone with the link can view, then paste that link again.");
        }

        return response;
    }

    static async Task<Uri> ResolveRedirectsAsync(HttpClient http, Uri uri, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        request.Headers.TryAddWithoutValidation(
            "User-Agent",
            "Mozilla/5.0 (compatible; BisyncCloud/1.0)");
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        return response.RequestMessage?.RequestUri ?? uri;
    }

    static async Task<Stream> CopyToTempFileAsync(Stream source, CancellationToken cancellationToken)
    {
        var path = Path.Combine(Path.GetTempPath(), $"bisync-cogs-{Guid.NewGuid():N}.bin");
        var file = new FileStream(
            path,
            FileMode.Create,
            FileAccess.ReadWrite,
            FileShare.None,
            1024 * 64,
            FileOptions.Asynchronous | FileOptions.DeleteOnClose);

        try
        {
            var buffer = new byte[1024 * 64];
            long total = 0;
            int read;
            while ((read = await source.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken)) > 0)
            {
                total += read;
                if (total > MaxBytes)
                    throw new InvalidOperationException($"Shared file exceeds the {MaxBytes / (1024 * 1024)} MB limit.");
                await file.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            }

            if (total == 0)
                throw new InvalidOperationException("Shared file is empty.");

            file.Position = 0;
            return file;
        }
        catch
        {
            await file.DisposeAsync();
            throw;
        }
    }

    static string? ExtractDriveFileId(string url)
    {
        var m = DriveFileId.Match(url);
        if (m.Success) return m.Groups[1].Value;
        m = DriveIdQuery.Match(url);
        return m.Success ? m.Groups[1].Value : null;
    }

    static string EncodeSharingUrl(string url)
    {
        var base64 = Convert.ToBase64String(Encoding.UTF8.GetBytes(url));
        return "u!" + base64.TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    static string ResolveFileName(HttpResponseMessage response, string fallback)
    {
        var cd = response.Content.Headers.ContentDisposition;
        var raw = cd?.FileNameStar ?? cd?.FileName;
        if (string.IsNullOrWhiteSpace(raw))
            return fallback;

        var name = raw.Trim().Trim('"');
        try { name = Uri.UnescapeDataString(name); } catch { /* keep raw */ }
        return string.IsNullOrWhiteSpace(name) ? fallback : Path.GetFileName(name);
    }

    static string EnsureCsvName(string name)
    {
        if (name.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
            || name.EndsWith(".csv.gz", StringComparison.OrdinalIgnoreCase)
            || name.EndsWith(".gz", StringComparison.OrdinalIgnoreCase))
            return name;
        return name + ".csv";
    }

    static bool IsHtmlResponse(string contentType, string? fileName)
    {
        if (contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
            return true;
        if (!string.IsNullOrEmpty(fileName)
            && (fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
                || fileName.EndsWith(".gz", StringComparison.OrdinalIgnoreCase)))
            return false;
        return false;
    }

    static async Task<string> SafeReadSnippetAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            var text = await response.Content.ReadAsStringAsync(cancellationToken);
            text = Regex.Replace(text, @"<[^>]+>", " ");
            text = Regex.Replace(text, @"\s+", " ").Trim();
            return text.Length > 160 ? text[..160] + "…" : text;
        }
        catch
        {
            return "";
        }
    }
}
