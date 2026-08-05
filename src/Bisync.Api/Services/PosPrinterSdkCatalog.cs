using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>Seeds and resolves the POS printer SDK repository (DantSu only).</summary>
public static class PosPrinterSdkCatalog
{
    public const string DantsuSdkCode = "dantsu-escpos-android";

    public static readonly PosPrinterSdk DantsuSdk = new()
    {
        SdkCode = DantsuSdkCode,
        Brand = "DantSu",
        DisplayName = "ESCPOS ThermalPrinter Android",
        Protocol = "escpos",
        Version = "3.4.0",
        Description =
            "DantSu Android SDK for ESC/POS thermal printers (Bluetooth, TCP, USB). Download and install on the Android POS device.",
        ModelHints = "dantsu,android,bluetooth,usb,escpos-thermalprinter,generic,thermal,receipt,epson,star,citizen,bixolon",
        DefaultPort = 9100,
        SupportedPaperWidthsJson = "[58,80,112]",
        Platform = "android",
        PackageKind = "android-aar",
        ExternalUrl = "https://github.com/DantSu/ESCPOS-ThermalPrinter-Android",
        ArtifactFolder = "dantsu-escpos-android",
    };

    public static readonly IReadOnlyList<PosPrinterSdk> BuiltIn = [DantsuSdk];

    public static async Task EnsureSeededAsync(BisyncDbContext db, CancellationToken cancellationToken = default)
    {
        var existingRows = await db.PosPrinterSdks.ToListAsync(cancellationToken);
        var byCode = existingRows.ToDictionary(s => s.SdkCode, StringComparer.OrdinalIgnoreCase);
        var now = DateTime.UtcNow;
        var keep = new HashSet<string>(BuiltIn.Select(s => s.SdkCode), StringComparer.OrdinalIgnoreCase);

        foreach (var seed in BuiltIn)
        {
            if (!byCode.TryGetValue(seed.SdkCode, out var row))
            {
                db.PosPrinterSdks.Add(new PosPrinterSdk
                {
                    SdkCode = seed.SdkCode,
                    Brand = seed.Brand,
                    DisplayName = seed.DisplayName,
                    Protocol = seed.Protocol,
                    Version = seed.Version,
                    Description = seed.Description,
                    ModelHints = seed.ModelHints,
                    DefaultPort = seed.DefaultPort,
                    SupportedPaperWidthsJson = seed.SupportedPaperWidthsJson,
                    Platform = seed.Platform,
                    PackageKind = seed.PackageKind,
                    ExternalUrl = seed.ExternalUrl,
                    ArtifactFolder = seed.ArtifactFolder,
                    Active = true,
                    CreatedAt = now,
                });
                continue;
            }

            row.Brand = seed.Brand;
            row.DisplayName = seed.DisplayName;
            row.Protocol = seed.Protocol;
            row.Version = seed.Version;
            row.Description = seed.Description;
            row.ModelHints = seed.ModelHints;
            row.DefaultPort = seed.DefaultPort;
            row.SupportedPaperWidthsJson = seed.SupportedPaperWidthsJson;
            row.Platform = seed.Platform;
            row.PackageKind = seed.PackageKind;
            row.ExternalUrl = seed.ExternalUrl;
            row.ArtifactFolder = seed.ArtifactFolder;
            row.Active = true;
        }

        // Remove every other printer driver from the catalog completely.
        foreach (var row in existingRows)
        {
            if (keep.Contains(row.SdkCode))
                continue;
            db.PosPrinterSdks.Remove(row);
        }

        // Remap any devices still pointing at retired SDK codes.
        var devices = await db.PosDevices
            .Where(d => d.DeviceType == "printer")
            .ToListAsync(cancellationToken);
        foreach (var device in devices)
        {
            if (string.IsNullOrWhiteSpace(device.PrinterSdkCode)
                || !string.Equals(device.PrinterSdkCode, DantsuSdkCode, StringComparison.OrdinalIgnoreCase))
            {
                device.PrinterSdkCode = DantsuSdkCode;
                device.UpdatedAt = now;
            }
        }

        if (db.ChangeTracker.HasChanges())
            await db.SaveChangesAsync(cancellationToken);
    }

    public static string SuggestSdkCode(string? brand = null, string? model = null, string? platformHint = null)
        => DantsuSdkCode;

    /// <summary>Resolve the on-disk folder for a vendored SDK package (AAR/zip/docs).</summary>
    public static string? ResolveArtifactDirectory(IWebHostEnvironment env, PosPrinterSdk sdk)
    {
        var folder = string.IsNullOrWhiteSpace(sdk.ArtifactFolder) ? sdk.SdkCode : sdk.ArtifactFolder.Trim();
        if (string.IsNullOrWhiteSpace(folder))
            return null;

        var candidates = new[]
        {
            Path.Combine(env.ContentRootPath, "Assets", "PosPrinterSdks", folder),
            Path.Combine(AppContext.BaseDirectory, "Assets", "PosPrinterSdks", folder),
        };

        foreach (var path in candidates)
        {
            if (Directory.Exists(path))
                return path;
        }

        return null;
    }
}
