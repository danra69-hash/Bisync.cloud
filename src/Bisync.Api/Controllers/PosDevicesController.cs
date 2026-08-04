using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
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

    public record LanCheckRequest(
        int CompanyId,
        string? LocationExternalId,
        string[]? ClientLocalIps);

    /// <summary>
    /// Combine this station's reported LAN IPs, API host NICs, and registered devices
    /// for Device Setup network check.
    /// </summary>
    [HttpPost("lan-check")]
    public async Task<ActionResult<object>> LanCheck(
        [FromBody] LanCheckRequest request,
        CancellationToken cancellationToken)
    {
        if (request.CompanyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var clientIps = (request.ClientLocalIps ?? [])
            .Select(ip => (ip ?? string.Empty).Trim())
            .Where(ip => ip.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(16)
            .ToArray();

        var locationId = (request.LocationExternalId ?? string.Empty).Trim();
        var q = db.PosDevices.AsNoTracking().Where(d => d.CompanyId == request.CompanyId);
        if (!string.IsNullOrWhiteSpace(locationId))
            q = q.Where(d => d.LocationExternalId == locationId);

        var devices = await q
            .OrderByDescending(d => d.Active)
            .ThenBy(d => d.Name)
            .Take(200)
            .ToListAsync(cancellationToken);

        var hostHints = BuildHostInterfaceHints();
        var visible = devices.Select(d =>
        {
            var sameSubnet = false;
            if (!string.IsNullOrWhiteSpace(d.HostAddress) && clientIps.Length > 0)
            {
                foreach (var cip in clientIps)
                {
                    if (SameIpv4Subnet(cip, d.HostAddress, d.SubnetMask))
                    {
                        sameSubnet = true;
                        break;
                    }
                }
            }

            return new
            {
                id = d.Id,
                name = d.Name,
                deviceType = d.DeviceType,
                deviceTypeLabel = DeviceTypeLabel(d.DeviceType),
                connectionType = d.ConnectionType,
                hostAddress = d.HostAddress,
                port = d.Port,
                macAddress = d.MacAddress,
                active = d.Active,
                sameSubnetAsStation = sameSubnet,
                isLocalPeripheral = string.Equals(d.ConnectionType, "usb", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(d.ConnectionType, "bluetooth", StringComparison.OrdinalIgnoreCase),
            };
        }).ToArray();

        return Ok(new
        {
            checkedAt = DateTime.UtcNow,
            clientLocalIps = clientIps,
            serverInterfaces = hostHints,
            registeredDevices = visible,
            privateRanges = new[]
            {
                new { cidr = "192.168.0.0/16", example = "192.168.1.10", label = "Home / small office" },
                new { cidr = "10.0.0.0/8", example = "10.0.0.50", label = "Corporate LAN" },
                new { cidr = "172.16.0.0/12", example = "172.16.0.20", label = "Private class B" },
            },
            note = clientIps.Length > 0
                ? "Station LAN addresses detected in the browser. Registered devices on the same subnet are highlighted. Cloud APIs cannot ARP-scan your venue — add devices by IP or USB below."
                : "Could not detect this station’s private IP in the browser. Enter device IPs manually, or use USB/Bluetooth for local peripherals.",
        });
    }

    [HttpGet("printer-sdks/{sdkCode}/package")]
    public async Task<IActionResult> DownloadSdkPackage(string sdkCode, CancellationToken cancellationToken)
    {
        await PosPrinterSdkCatalog.EnsureSeededAsync(db, cancellationToken);
        var code = (sdkCode ?? string.Empty).Trim();
        var sdk = await db.PosPrinterSdks.AsNoTracking()
            .FirstOrDefaultAsync(s => s.SdkCode == code && s.Active, cancellationToken);
        if (sdk is null)
            return NotFound(new { message = $"SDK '{code}' not found." });

        var package = new
        {
            packageType = "bisync-pos-printer-sdk",
            sdkCode = sdk.SdkCode,
            brand = sdk.Brand,
            displayName = sdk.DisplayName,
            protocol = sdk.Protocol,
            version = sdk.Version,
            description = sdk.Description,
            modelHints = sdk.ModelHints,
            defaultPort = sdk.DefaultPort,
            supportedPaperWidthsMm = ParseWidths(sdk.SupportedPaperWidthsJson),
            install = new
            {
                steps = new[]
                {
                    "Save this package on the POS station.",
                    "In Device set up, select the printer and choose this SDK, then click Install driver.",
                    "Complete paper width and alignment in printer setup.",
                },
                deployEndpoint = $"/api/pos-devices/{{deviceId}}/deploy-sdk",
            },
            downloadedAt = DateTime.UtcNow,
        };

        var json = JsonSerializer.Serialize(package, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        });
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);
        var fileName = $"bisync-{sdk.SdkCode}-driver.json";
        return File(bytes, "application/json", fileName);
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
            message = $"Deployed {sdk.DisplayName} ({sdk.SdkCode}) for this printer. Running test print…",
        });
    }

    /// <summary>
    /// Send a short ESC/POS alignment slip to a linked network printer (TCP 9100-style).
    /// Called automatically after driver install from Device Setup.
    /// </summary>
    [HttpPost("{id:int}/test-print")]
    public async Task<ActionResult<object>> TestPrint(int id, CancellationToken cancellationToken)
    {
        var device = await db.PosDevices.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);
        if (device is null)
            return NotFound(new { message = "Device not found." });
        if (!string.Equals(device.DeviceType, "printer", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Test print applies to Printer devices only." });

        await PosPrinterSdkCatalog.EnsureSeededAsync(db, cancellationToken);
        var sdkCode = string.IsNullOrWhiteSpace(device.PrinterSdkCode)
            ? "generic-escpos"
            : device.PrinterSdkCode.Trim();
        var sdk = await db.PosPrinterSdks.AsNoTracking()
            .FirstOrDefaultAsync(s => s.SdkCode == sdkCode, cancellationToken);
        var sdkName = sdk?.DisplayName ?? sdkCode;

        var connection = (device.ConnectionType ?? "").Trim().ToLowerInvariant();
        if (connection is "usb" or "bluetooth")
        {
            return Ok(new
            {
                sent = false,
                skipped = true,
                device = MapDevice(device),
                message =
                    $"Driver is linked for “{device.Name}”. USB/Bluetooth test print must be sent from the station that owns the cable — use Test print after confirming the peripheral is selected on this device.",
            });
        }

        var host = (device.HostAddress ?? string.Empty).Trim();
        var port = device.Port is > 0 and <= 65535
            ? device.Port.Value
            : (sdk?.DefaultPort > 0 ? sdk.DefaultPort : 9100);
        if (string.IsNullOrWhiteSpace(host))
        {
            return BadRequest(new
            {
                message = "Set the printer IP address before running a test print.",
            });
        }

        var payload = BuildEscPosTestSlip(device, sdkName);
        var started = DateTime.UtcNow;
        try
        {
            using var client = new TcpClient();
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(4));
            await client.ConnectAsync(host, port, cts.Token);
            await using var stream = client.GetStream();
            await stream.WriteAsync(payload, cts.Token);
            await stream.FlushAsync(cts.Token);

            return Ok(new
            {
                sent = true,
                skipped = false,
                host,
                port,
                bytes = payload.Length,
                durationMs = (int)(DateTime.UtcNow - started).TotalMilliseconds,
                device = MapDevice(device),
                message = $"Test print sent to {device.Name} ({host}:{port}). Check the printer for the Bisync slip.",
            });
        }
        catch (OperationCanceledException)
        {
            return Ok(new
            {
                sent = false,
                skipped = false,
                host,
                port,
                durationMs = (int)(DateTime.UtcNow - started).TotalMilliseconds,
                device = MapDevice(device),
                message =
                    $"Driver installed, but test print timed out reaching {host}:{port}. If Bisync is hosted in the cloud, run Test print from a POS on the same LAN as the printer.",
            });
        }
        catch (SocketException ex)
        {
            return Ok(new
            {
                sent = false,
                skipped = false,
                host,
                port,
                durationMs = (int)(DateTime.UtcNow - started).TotalMilliseconds,
                device = MapDevice(device),
                message =
                    $"Driver installed, but test print could not reach {host}:{port} ({ex.SocketErrorCode}). Confirm IP/port and that the printer is on the same LAN.",
            });
        }
        catch (Exception ex)
        {
            return Ok(new
            {
                sent = false,
                skipped = false,
                host,
                port,
                durationMs = (int)(DateTime.UtcNow - started).TotalMilliseconds,
                device = MapDevice(device),
                message = $"Driver installed, but test print failed: {ex.Message}",
            });
        }
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

    static byte[] BuildEscPosTestSlip(PosDevice device, string sdkName)
    {
        var align = string.Equals(device.PrintAlignment, "center", StringComparison.OrdinalIgnoreCase)
            ? (byte)1
            : (byte)0;
        var width = device.PaperWidthMm is 58 or 80 or 112 ? device.PaperWidthMm : 80;
        using var ms = new MemoryStream();
        void WriteBytes(params byte[] bytes) => ms.Write(bytes, 0, bytes.Length);
        void WriteLine(string text)
        {
            var line = Encoding.ASCII.GetBytes(text + "\n");
            ms.Write(line, 0, line.Length);
        }

        WriteBytes(0x1B, 0x40); // Initialize
        WriteBytes(0x1B, 0x61, align); // Alignment
        WriteBytes(0x1B, 0x45, 0x01); // Bold on
        WriteLine("Bisync POS");
        WriteBytes(0x1B, 0x45, 0x00); // Bold off
        WriteLine($"Test print · {sdkName}");
        WriteLine($"Printer: {device.Name}");
        WriteLine($"Paper {width}mm · align {(align == 1 ? "center" : "left")}");
        WriteLine($"Margins L{device.PrintMarginLeft} R{device.PrintMarginRight}");
        WriteLine(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
        WriteLine("------------------------");
        WriteLine("Printer link OK");
        WriteBytes(0x1B, 0x64, 0x04); // Feed lines
        WriteBytes(0x1D, 0x56, 0x00); // Full cut
        return ms.ToArray();
    }

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

    static bool SameIpv4Subnet(string a, string b, string? subnetMask)
    {
        if (!IPAddress.TryParse(a.Trim(), out var ipA) || !IPAddress.TryParse(b.Trim(), out var ipB))
            return false;
        if (ipA.AddressFamily != AddressFamily.InterNetwork || ipB.AddressFamily != AddressFamily.InterNetwork)
            return false;

        var maskText = string.IsNullOrWhiteSpace(subnetMask) ? "255.255.255.0" : subnetMask.Trim();
        if (!IPAddress.TryParse(maskText, out var mask))
            mask = IPAddress.Parse("255.255.255.0");

        var aBytes = ipA.GetAddressBytes();
        var bBytes = ipB.GetAddressBytes();
        var mBytes = mask.GetAddressBytes();
        for (var i = 0; i < 4; i++)
        {
            if ((aBytes[i] & mBytes[i]) != (bBytes[i] & mBytes[i]))
                return false;
        }
        return true;
    }

    static int[] ParseWidths(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<int[]>(json) ?? [58, 80];
        }
        catch
        {
            return [58, 80];
        }
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
        var widths = ParseWidths(s.SupportedPaperWidthsJson);

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
            downloadPath = $"/api/pos-devices/printer-sdks/{s.SdkCode}/package",
        };
    }
}
