using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>Seeds and resolves the POS printer SDK repository.</summary>
public static class PosPrinterSdkCatalog
{
    public static readonly IReadOnlyList<PosPrinterSdk> BuiltIn =
    [
        new()
        {
            SdkCode = "generic-escpos",
            Brand = "Generic",
            DisplayName = "Generic ESC/POS",
            Protocol = "escpos",
            Version = "1.0",
            Description = "Standard ESC/POS thermal dialect for most network/USB printers.",
            ModelHints = "generic,thermal,receipt",
            DefaultPort = 9100,
            SupportedPaperWidthsJson = "[58,80,112]",
            Platform = "any",
            PackageKind = "dialect",
        },
        new()
        {
            SdkCode = "epson-escpos",
            Brand = "Epson",
            DisplayName = "Epson ePOS / ESC/POS",
            Protocol = "escpos",
            Version = "1.0",
            Description = "Epson TM-series thermal printers (TM-T20, TM-T88, TM-m30).",
            ModelHints = "epson,tm-t20,tm-t88,tm-m30,tm-u220",
            DefaultPort = 9100,
            SupportedPaperWidthsJson = "[58,80]",
            Platform = "any",
            PackageKind = "dialect",
        },
        new()
        {
            SdkCode = "star-linemode",
            Brand = "Star Micronics",
            DisplayName = "Star Line Mode / ESC/POS",
            Protocol = "star",
            Version = "1.0",
            Description = "Star mC-Print / TSP series network printers.",
            ModelHints = "star,mc-print,tsp100,tsp143",
            DefaultPort = 9100,
            SupportedPaperWidthsJson = "[58,80]",
            Platform = "any",
            PackageKind = "dialect",
        },
        new()
        {
            SdkCode = "citizen-escpos",
            Brand = "Citizen",
            DisplayName = "Citizen ESC/POS",
            Protocol = "escpos",
            Version = "1.0",
            Description = "Citizen CT-S / CT-E thermal printers.",
            ModelHints = "citizen,ct-s,ct-e",
            DefaultPort = 9100,
            SupportedPaperWidthsJson = "[58,80]",
            Platform = "any",
            PackageKind = "dialect",
        },
        new()
        {
            SdkCode = "bixolon-escpos",
            Brand = "Bixolon",
            DisplayName = "Bixolon ESC/POS",
            Protocol = "escpos",
            Version = "1.0",
            Description = "Bixolon SRP / SPP series receipt printers.",
            ModelHints = "bixolon,srp,spp",
            DefaultPort = 9100,
            SupportedPaperWidthsJson = "[58,80]",
            Platform = "any",
            PackageKind = "dialect",
        },
        new()
        {
            SdkCode = "network-raw",
            Brand = "Network",
            DisplayName = "Raw TCP (port 9100)",
            Protocol = "raw",
            Version = "1.0",
            Description = "Byte stream to a raw TCP printer port when brand SDK is unknown.",
            ModelHints = "raw,jetdirect,9100",
            DefaultPort = 9100,
            SupportedPaperWidthsJson = "[58,80,112]",
            Platform = "any",
            PackageKind = "dialect",
        },
        new()
        {
            SdkCode = "dantsu-escpos-android",
            Brand = "DantSu",
            DisplayName = "ESCPOS ThermalPrinter Android",
            Protocol = "escpos",
            Version = "3.4.0",
            Description =
                "DantSu Android SDK for ESC/POS thermal printers (Bluetooth, TCP, USB). Download and install on the Android POS device.",
            ModelHints = "dantsu,android,bluetooth,usb,escpos-thermalprinter",
            DefaultPort = 9100,
            SupportedPaperWidthsJson = "[58,80,112]",
            Platform = "android",
            PackageKind = "android-aar",
            ExternalUrl = "https://github.com/DantSu/ESCPOS-ThermalPrinter-Android",
            ArtifactFolder = "dantsu-escpos-android",
        },
    ];

    public static async Task EnsureSeededAsync(BisyncDbContext db, CancellationToken cancellationToken = default)
    {
        var existingRows = await db.PosPrinterSdks.ToListAsync(cancellationToken);
        var byCode = existingRows.ToDictionary(s => s.SdkCode, StringComparer.OrdinalIgnoreCase);
        var now = DateTime.UtcNow;
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

            // Keep catalog metadata in sync for built-in packages (esp. Android AAR updates).
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
            if (!row.Active && string.Equals(seed.SdkCode, "dantsu-escpos-android", StringComparison.OrdinalIgnoreCase))
                row.Active = true;
        }

        if (db.ChangeTracker.HasChanges())
            await db.SaveChangesAsync(cancellationToken);
    }

    public static string SuggestSdkCode(string? brand, string? model, string? platformHint = null)
    {
        var hay = $"{brand} {model}".Trim().ToLowerInvariant();
        var platform = (platformHint ?? "").Trim().ToLowerInvariant();

        if (platform is "android" || hay.Contains("android") || hay.Contains("dantsu"))
            return "dantsu-escpos-android";

        if (string.IsNullOrWhiteSpace(hay))
            return "generic-escpos";

        foreach (var sdk in BuiltIn)
        {
            if (string.Equals(sdk.Platform, "android", StringComparison.OrdinalIgnoreCase))
                continue;
            var hints = sdk.ModelHints.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (hints.Any(h => hay.Contains(h, StringComparison.OrdinalIgnoreCase)))
                return sdk.SdkCode;
        }

        return "generic-escpos";
    }

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
