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
        },
    ];

    public static async Task EnsureSeededAsync(BisyncDbContext db, CancellationToken cancellationToken = default)
    {
        var existing = await db.PosPrinterSdks.AsNoTracking()
            .Select(s => s.SdkCode)
            .ToListAsync(cancellationToken);
        var have = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);
        var now = DateTime.UtcNow;
        foreach (var seed in BuiltIn)
        {
            if (have.Contains(seed.SdkCode))
                continue;
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
                Active = true,
                CreatedAt = now,
            });
        }

        if (db.ChangeTracker.HasChanges())
            await db.SaveChangesAsync(cancellationToken);
    }

    public static string SuggestSdkCode(string? brand, string? model)
    {
        var hay = $"{brand} {model}".Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(hay))
            return "generic-escpos";

        foreach (var sdk in BuiltIn)
        {
            var hints = sdk.ModelHints.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (hints.Any(h => hay.Contains(h, StringComparison.OrdinalIgnoreCase)))
                return sdk.SdkCode;
        }

        return "generic-escpos";
    }
}
