using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pos-devices")]
public class PosDevicesController(BisyncDbContext db) : ControllerBase
{
    static readonly HashSet<string> DeviceTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "posMain", "posOrderStation", "kitchenDisplay", "barDisplay", "kiosk", "printer",
    };

    static readonly HashSet<string> ConnectionTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "ethernet", "wifi", "usb", "bluetooth", "cloud",
    };

    static readonly HashSet<int> PaperWidths = [58, 80, 112];

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int companyId,
        [FromQuery] string? locationExternalId,
        CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        await PosPrinterSdkCatalog.EnsureSeededAsync(db, cancellationToken);

        var query = db.PosDevices.AsNoTracking().Where(d => d.CompanyId == companyId);
        if (!string.IsNullOrWhiteSpace(locationExternalId))
            query = query.Where(d => d.LocationExternalId == locationExternalId.Trim());

        var rows = await query
            .OrderBy(d => d.DeviceType)
            .ThenBy(d => d.Name)
            .ToListAsync(cancellationToken);

        return Ok(rows.Select(MapDevice));
    }

    [HttpGet("printer-sdks")]
    public async Task<ActionResult<IEnumerable<object>>> ListPrinterSdks(CancellationToken cancellationToken)
    {
        await PosPrinterSdkCatalog.EnsureSeededAsync(db, cancellationToken);
        var rows = await db.PosPrinterSdks.AsNoTracking()
            .Where(s => s.Active)
            .OrderBy(s => s.Brand)
            .ThenBy(s => s.DisplayName)
            .ToListAsync(cancellationToken);
        return Ok(rows.Select(MapSdk));
    }

    [HttpGet("network-suggestions")]
    public ActionResult<object> NetworkSuggestions([FromQuery] string? deviceType)
    {
        var type = NormalizeDeviceType(deviceType) ?? "posMain";
        var defaultPort = DefaultPortFor(type);
        var hostHints = BuildHostInterfaceHints();

        return Ok(new
        {
            deviceType = type,
            defaultPort,
            note =
                "Cloud-hosted APIs cannot see your venue LAN. Use these common private ranges and any addresses detected on this server, then enter the IP your POS terminal can reach.",
            privateRanges =
                new[]
                {
                    new { cidr = "192.168.0.0/16", example = "192.168.1.10", label = "Home / small office (most common)" },
                    new { cidr = "10.0.0.0/8", example = "10.0.0.50", label = "Corporate / larger private LAN" },
                    new { cidr = "172.16.0.0/12", example = "172.16.0.20", label = "Private class B" },
                },
            commonPorts = new[]
            {
                new { port = 9100, label = "Raw / ESC/POS printer (JetDirect)" },
                new { port = 8008, label = "Epson ePOS HTTP" },
                new { port = 80, label = "HTTP device / KDS web" },
                new { port = 443, label = "HTTPS device" },
                new { port = 9101, label = "Alternate printer port" },
            },
            hostInterfaces = hostHints,
            connectionTips = new[]
            {
                "Ask IT for the printer/station static IP, or check the device’s network sticker / menu.",
                "Prefer static DHCP reservation so the address does not change after reboot.",
                "From the POS terminal, ping the IP or open http://IP:port when the device serves HTTP.",
                "USB/Bluetooth printers may leave Host blank — connection is local to the station.",
            },
        });
    }

    [HttpPost("network-probe")]
    public async Task<ActionResult<object>> ProbeNetwork(
        [FromBody] PosDeviceNetworkProbeRequest request,
        CancellationToken cancellationToken)
    {
        var host = (request.HostAddress ?? string.Empty).Trim();
        var port = request.Port ?? DefaultPortFor(NormalizeDeviceType(request.DeviceType) ?? "printer");
        if (string.IsNullOrWhiteSpace(host))
            return BadRequest(new { message = "Enter a host address (IP or hostname) to probe." });
        if (port is < 1 or > 65535)
            return BadRequest(new { message = "Port must be between 1 and 65535." });

        var suggestions = BuildHostInterfaceHints();
        var reachable = false;
        var detail = string.Empty;
        var started = DateTime.UtcNow;

        try
        {
            using var client = new TcpClient();
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(2.5));
            await client.ConnectAsync(host, port, cts.Token);
            reachable = client.Connected;
            detail = reachable
                ? $"TCP connect succeeded to {host}:{port}."
                : $"TCP connect to {host}:{port} did not establish.";
        }
        catch (OperationCanceledException)
        {
            detail =
                $"Timed out reaching {host}:{port}. If Bisync runs in the cloud, probe the address from the POS terminal on the same LAN instead.";
        }
        catch (SocketException ex)
        {
            detail = $"Cannot reach {host}:{port} ({ex.SocketErrorCode}). Check IP, port, firewall, and that the device is on.";
        }
        catch (Exception ex)
        {
            detail = $"Probe failed: {ex.Message}";
        }

        return Ok(new
        {
            host,
            port,
            reachable,
            detail,
            probedAt = started,
            durationMs = (int)(DateTime.UtcNow - started).TotalMilliseconds,
            hostInterfaces = suggestions,
            guidance = reachable
                ? "Address looks reachable from the API host. Save it on the device if this matches your venue network."
                : "Not reachable from this API host (normal for Cloud Run vs private LAN). Confirm the IP from a PC/POS on the same Wi‑Fi/LAN, then save.",
        });
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id, CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (device is null)
            return NotFound(new { message = "Device not found." });
        return Ok(MapDevice(device));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] UpsertPosDeviceRequest request,
        CancellationToken cancellationToken)
    {
        await PosPrinterSdkCatalog.EnsureSeededAsync(db, cancellationToken);
        var parsed = await ValidateAndNormalizeAsync(request, cancellationToken);
        if (parsed.Error is { } err)
            return BadRequest(new { message = err });

        var device = parsed.Device!;
        device.CreatedAt = DateTime.UtcNow;
        device.UpdatedAt = device.CreatedAt;
        db.PosDevices.Add(device);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = device.Id }, MapDevice(device));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(
        int id,
        [FromBody] UpsertPosDeviceRequest request,
        CancellationToken cancellationToken)
    {
        var existing = await db.PosDevices.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (existing is null)
            return NotFound(new { message = "Device not found." });

        await PosPrinterSdkCatalog.EnsureSeededAsync(db, cancellationToken);
        var parsed = await ValidateAndNormalizeAsync(request, cancellationToken);
        if (parsed.Error is { } err)
            return BadRequest(new { message = err });

        var next = parsed.Device!;
        existing.CompanyId = next.CompanyId;
        existing.LocationExternalId = next.LocationExternalId;
        existing.Name = next.Name;
        existing.DeviceType = next.DeviceType;
        existing.ConnectionType = next.ConnectionType;
        existing.HostAddress = next.HostAddress;
        existing.Port = next.Port;
        existing.MacAddress = next.MacAddress;
        existing.SubnetMask = next.SubnetMask;
        existing.Gateway = next.Gateway;
        existing.DnsPrimary = next.DnsPrimary;
        existing.DnsSecondary = next.DnsSecondary;
        existing.Hostname = next.Hostname;
        existing.PrinterSdkCode = next.PrinterSdkCode;
        existing.PrinterBrand = next.PrinterBrand;
        existing.PrinterModel = next.PrinterModel;
        existing.PaperWidthMm = next.PaperWidthMm;
        existing.PrintAlignment = next.PrintAlignment;
        existing.PrintMarginLeft = next.PrintMarginLeft;
        existing.PrintMarginRight = next.PrintMarginRight;
        existing.PrinterSetupComplete = next.PrinterSetupComplete;
        existing.Active = next.Active;
        existing.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapDevice(existing));
    }

    [HttpPost("{id:int}/deploy-sdk")]
    public async Task<ActionResult<object>> DeploySdk(int id, CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (device is null)
            return NotFound(new { message = "Device not found." });
        if (!string.Equals(device.DeviceType, "printer", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "SDK deploy applies to Printer devices only." });

        await PosPrinterSdkCatalog.EnsureSeededAsync(db, cancellationToken);
        var sdkCode = string.IsNullOrWhiteSpace(device.PrinterSdkCode)
            ? PosPrinterSdkCatalog.SuggestSdkCode(device.PrinterBrand, device.PrinterModel)
            : device.PrinterSdkCode;
        var sdk = await db.PosPrinterSdks.AsNoTracking()
            .FirstOrDefaultAsync(s => s.SdkCode == sdkCode && s.Active, cancellationToken);
        if (sdk is null)
            return BadRequest(new { message = $"Printer SDK '{sdkCode}' is not in the repository." });

        device.PrinterSdkCode = sdk.SdkCode;
        if (string.IsNullOrWhiteSpace(device.PrinterBrand))
            device.PrinterBrand = sdk.Brand;
        if (device.Port is null or <= 0)
            device.Port = sdk.DefaultPort;
        device.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            device = MapDevice(device),
            sdk = MapSdk(sdk),
            deployed = true,
            message = $"Deployed {sdk.DisplayName} ({sdk.SdkCode}) for this printer. Continue with paper size & alignment setup.",
        });
    }

    [HttpPost("{id:int}/printer-setup")]
    public async Task<ActionResult<object>> PrinterSetup(
        int id,
        [FromBody] PosPrinterSetupRequest request,
        CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (device is null)
            return NotFound(new { message = "Device not found." });
        if (!string.Equals(device.DeviceType, "printer", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Printer setup applies to Printer devices only." });
        if (!PaperWidths.Contains(request.PaperWidthMm))
            return BadRequest(new { message = "Paper width must be 58, 80, or 112 mm." });

        var align = (request.PrintAlignment ?? "left").Trim().ToLowerInvariant();
        if (align is not ("left" or "center"))
            return BadRequest(new { message = "Alignment must be left or center." });

        if (!string.IsNullOrWhiteSpace(request.PrinterSdkCode))
            device.PrinterSdkCode = request.PrinterSdkCode.Trim();
        if (!string.IsNullOrWhiteSpace(request.PrinterBrand))
            device.PrinterBrand = request.PrinterBrand.Trim();
        if (!string.IsNullOrWhiteSpace(request.PrinterModel))
            device.PrinterModel = request.PrinterModel.Trim();

        if (string.IsNullOrWhiteSpace(device.PrinterSdkCode))
        {
            device.PrinterSdkCode = PosPrinterSdkCatalog.SuggestSdkCode(device.PrinterBrand, device.PrinterModel);
        }

        device.PaperWidthMm = request.PaperWidthMm;
        device.PrintAlignment = align;
        device.PrintMarginLeft = Math.Max(0, request.PrintMarginLeft);
        device.PrintMarginRight = Math.Max(0, request.PrintMarginRight);
        device.PrinterSetupComplete = request.MarkComplete;
        device.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(MapDevice(device));
    }

    [HttpPatch("{id:int}/active")]
    public async Task<ActionResult<object>> SetActive(
        int id,
        [FromBody] SetPosPromotionActiveRequest request,
        CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (device is null)
            return NotFound(new { message = "Device not found." });
        device.Active = request.Active;
        device.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapDevice(device));
    }

    async Task<(PosDevice? Device, string? Error)> ValidateAndNormalizeAsync(
        UpsertPosDeviceRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CompanyId <= 0)
            return (null, "Company is required.");
        var locationId = (request.LocationExternalId ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(locationId))
            return (null, "Location is required.");
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
            return (null, "Device name is required.");

        var deviceType = NormalizeDeviceType(request.DeviceType);
        if (deviceType is null)
            return (null, "Select a valid device type.");

        var connection = (request.ConnectionType ?? "ethernet").Trim().ToLowerInvariant();
        if (!ConnectionTypes.Contains(connection))
            return (null, "Connection type must be ethernet, wifi, usb, bluetooth, or cloud.");

        var align = (request.PrintAlignment ?? "left").Trim().ToLowerInvariant();
        if (align is not ("left" or "center"))
            align = "left";

        int? paper = request.PaperWidthMm;
        if (paper is int pw && !PaperWidths.Contains(pw))
            return (null, "Paper width must be 58, 80, or 112 mm.");

        var sdkCode = (request.PrinterSdkCode ?? string.Empty).Trim();
        var brand = (request.PrinterBrand ?? string.Empty).Trim();
        var model = (request.PrinterModel ?? string.Empty).Trim();

        if (deviceType == "printer")
        {
            if (string.IsNullOrWhiteSpace(sdkCode))
                sdkCode = PosPrinterSdkCatalog.SuggestSdkCode(brand, model);
            var sdkExists = await db.PosPrinterSdks.AsNoTracking()
                .AnyAsync(s => s.SdkCode == sdkCode && s.Active, cancellationToken);
            if (!sdkExists)
                return (null, $"Printer SDK '{sdkCode}' is not available. Pick one from the SDK repository.");
        }
        else
        {
            sdkCode = string.Empty;
            brand = string.Empty;
            model = string.Empty;
            paper = null;
        }

        var port = request.Port;
        if (port is null && connection is "ethernet" or "wifi" or "cloud")
            port = DefaultPortFor(deviceType);

        var device = new PosDevice
        {
            CompanyId = request.CompanyId,
            LocationExternalId = locationId,
            Name = name,
            DeviceType = deviceType,
            ConnectionType = connection,
            HostAddress = (request.HostAddress ?? string.Empty).Trim(),
            Port = port,
            MacAddress = (request.MacAddress ?? string.Empty).Trim(),
            SubnetMask = (request.SubnetMask ?? string.Empty).Trim(),
            Gateway = (request.Gateway ?? string.Empty).Trim(),
            DnsPrimary = (request.DnsPrimary ?? string.Empty).Trim(),
            DnsSecondary = (request.DnsSecondary ?? string.Empty).Trim(),
            Hostname = (request.Hostname ?? string.Empty).Trim(),
            PrinterSdkCode = sdkCode,
            PrinterBrand = brand,
            PrinterModel = model,
            PaperWidthMm = paper,
            PrintAlignment = align,
            PrintMarginLeft = Math.Max(0, request.PrintMarginLeft ?? 0),
            PrintMarginRight = Math.Max(0, request.PrintMarginRight ?? 0),
            PrinterSetupComplete = request.PrinterSetupComplete ?? false,
            Active = request.Active,
            CreatedBy = (request.CreatedBy ?? string.Empty).Trim(),
            NetworkNotesJson = "{}",
        };

        return (device, null);
    }

    static string? NormalizeDeviceType(string? raw)
    {
        var value = (raw ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(value))
            return null;
        // Accept labels with spaces from UI.
        var compact = value.Replace(" ", "", StringComparison.OrdinalIgnoreCase);
        foreach (var type in DeviceTypes)
        {
            if (string.Equals(type, value, StringComparison.OrdinalIgnoreCase)
                || string.Equals(type, compact, StringComparison.OrdinalIgnoreCase))
                return type;
        }

        return value switch
        {
            _ when value.Contains("cashier", StringComparison.OrdinalIgnoreCase)
                || value.Contains("main", StringComparison.OrdinalIgnoreCase) => "posMain",
            _ when value.Contains("order", StringComparison.OrdinalIgnoreCase) => "posOrderStation",
            _ when value.Contains("kitchen", StringComparison.OrdinalIgnoreCase) => "kitchenDisplay",
            _ when value.Contains("bar", StringComparison.OrdinalIgnoreCase) => "barDisplay",
            _ when value.Contains("kiosk", StringComparison.OrdinalIgnoreCase) => "kiosk",
            _ when value.Contains("printer", StringComparison.OrdinalIgnoreCase) => "printer",
            _ => null,
        };
    }

    static int DefaultPortFor(string deviceType) =>
        deviceType switch
        {
            "printer" => 9100,
            "kitchenDisplay" or "barDisplay" => 80,
            "kiosk" => 443,
            _ => 443,
        };

    static List<object> BuildHostInterfaceHints()
    {
        var hints = new List<object>();
        try
        {
            foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (nic.OperationalStatus != OperationalStatus.Up)
                    continue;
                if (nic.NetworkInterfaceType is NetworkInterfaceType.Loopback)
                    continue;
                var props = nic.GetIPProperties();
                foreach (var uni in props.UnicastAddresses)
                {
                    if (uni.Address.AddressFamily != AddressFamily.InterNetwork)
                        continue;
                    if (IPAddress.IsLoopback(uni.Address))
                        continue;
                    hints.Add(new
                    {
                        name = nic.Name,
                        address = uni.Address.ToString(),
                        subnet = uni.IPv4Mask?.ToString() ?? "",
                        isPrivate = IsPrivateIpv4(uni.Address),
                    });
                }
            }
        }
        catch
        {
            // Ignore — cloud containers may restrict NIC enumeration.
        }

        return hints;
    }

    static bool IsPrivateIpv4(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        if (bytes.Length != 4) return false;
        return bytes[0] == 10
            || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
            || (bytes[0] == 192 && bytes[1] == 168);
    }

    static object MapDevice(PosDevice d) => new
    {
        id = d.Id,
        companyId = d.CompanyId,
        locationExternalId = d.LocationExternalId,
        name = d.Name,
        deviceType = d.DeviceType,
        deviceTypeLabel = DeviceTypeLabel(d.DeviceType),
        connectionType = d.ConnectionType,
        hostAddress = d.HostAddress,
        port = d.Port,
        macAddress = d.MacAddress,
        subnetMask = d.SubnetMask,
        gateway = d.Gateway,
        dnsPrimary = d.DnsPrimary,
        dnsSecondary = d.DnsSecondary,
        hostname = d.Hostname,
        printerSdkCode = d.PrinterSdkCode,
        printerBrand = d.PrinterBrand,
        printerModel = d.PrinterModel,
        paperWidthMm = d.PaperWidthMm,
        printAlignment = d.PrintAlignment,
        printMarginLeft = d.PrintMarginLeft,
        printMarginRight = d.PrintMarginRight,
        printerSetupComplete = d.PrinterSetupComplete,
        lastProbeStatus = d.LastProbeStatus,
        lastProbedAt = d.LastProbedAt,
        active = d.Active,
        createdBy = d.CreatedBy,
        createdAt = d.CreatedAt,
        updatedAt = d.UpdatedAt,
    };

    static string DeviceTypeLabel(string type) => type switch
    {
        "posMain" => "POS Main (with Cashier Feature)",
        "posOrderStation" => "POS Order Station",
        "kitchenDisplay" => "Kitchen Display Unit",
        "barDisplay" => "Bar Display Unit",
        "kiosk" => "Kiosk",
        "printer" => "Printer",
        _ => type,
    };

    static object MapSdk(PosPrinterSdk s)
    {
        int[] widths;
        try
        {
            widths = JsonSerializer.Deserialize<int[]>(s.SupportedPaperWidthsJson) ?? [58, 80];
        }
        catch
        {
            widths = [58, 80];
        }

        return new
        {
            id = s.Id,
            sdkCode = s.SdkCode,
            brand = s.Brand,
            displayName = s.DisplayName,
            protocol = s.Protocol,
            version = s.Version,
            description = s.Description,
            modelHints = s.ModelHints,
            defaultPort = s.DefaultPort,
            supportedPaperWidthsMm = widths,
            active = s.Active,
        };
    }
}
