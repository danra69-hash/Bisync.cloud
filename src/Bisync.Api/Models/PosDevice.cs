namespace Bisync.Api.Models;

/// <summary>Registered POS hardware / station for a company location.</summary>
public class PosDevice
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string LocationExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    /// <summary>
    /// posMain | posOrderStation | kitchenDisplay | barDisplay | kiosk | printer
    /// </summary>
    public string DeviceType { get; set; } = string.Empty;
    /// <summary>ethernet | wifi | usb | bluetooth | cloud</summary>
    public string ConnectionType { get; set; } = "ethernet";
    public string HostAddress { get; set; } = string.Empty;
    public int? Port { get; set; }
    public string MacAddress { get; set; } = string.Empty;
    public string SubnetMask { get; set; } = string.Empty;
    public string Gateway { get; set; } = string.Empty;
    public string DnsPrimary { get; set; } = string.Empty;
    public string DnsSecondary { get; set; } = string.Empty;
    public string Hostname { get; set; } = string.Empty;
    /// <summary>JSON notes / last probe result.</summary>
    public string NetworkNotesJson { get; set; } = "{}";
    /// <summary>FK-ish code into PosPrinterSdks.SdkCode when DeviceType is printer.</summary>
    public string PrinterSdkCode { get; set; } = string.Empty;
    public string PrinterBrand { get; set; } = string.Empty;
    public string PrinterModel { get; set; } = string.Empty;
    /// <summary>Paper width mm: 58 | 80 | 112</summary>
    public int? PaperWidthMm { get; set; }
    /// <summary>left | center</summary>
    public string PrintAlignment { get; set; } = "left";
    public int PrintMarginLeft { get; set; }
    public int PrintMarginRight { get; set; }
    public bool PrinterSetupComplete { get; set; }
    public string LastProbeStatus { get; set; } = string.Empty;
    public DateTime? LastProbedAt { get; set; }
    public bool Active { get; set; } = true;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Catalog of installable printer SDKs / dialects for POS printers.</summary>
public class PosPrinterSdk
{
    public int Id { get; set; }
    public string SdkCode { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Protocol { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>Comma-separated model hints for auto-match.</summary>
    public string ModelHints { get; set; } = string.Empty;
    public int DefaultPort { get; set; } = 9100;
    public string SupportedPaperWidthsJson { get; set; } = "[58,80]";
    /// <summary>any | android | windows — which station OS this package targets.</summary>
    public string Platform { get; set; } = "any";
    /// <summary>dialect | android-aar | android-apk — how the download package is shaped.</summary>
    public string PackageKind { get; set; } = "dialect";
    /// <summary>Upstream docs / releases URL.</summary>
    public string ExternalUrl { get; set; } = string.Empty;
    /// <summary>Folder under Assets/PosPrinterSdks/{SdkCode} when a binary package is vendored.</summary>
    public string ArtifactFolder { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
