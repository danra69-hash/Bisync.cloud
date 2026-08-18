using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

/// <summary>POS Config — Device Set up: product → primary / secondary / concurrent device routing.</summary>
[ApiController]
[Route("api/pos-device-setup")]
public class PosDeviceSetupController(BisyncDbContext db) : ControllerBase
{
    public record UpsertRequest(
        int CompanyId,
        string? LocationExternalId = null,
        string? ProductCategory = null,
        string? ProductGroup = null,
        int? ProductId = null,
        string? ProductName = null,
        int? PrimaryDeviceId = null,
        int? SecondaryDeviceId = null,
        int? ConcurrentDeviceId = null,
        string? PrimaryDeviceType = null,
        string? SecondaryDeviceType = null,
        string? ConcurrentDeviceType = null,
        int Sequence = 0,
        bool Active = true);

    public record ActiveBody(bool Active);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int companyId,
        [FromQuery] string? locationExternalId,
        [FromQuery] bool includeInactive = true,
        CancellationToken cancellationToken = default)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        await SchemaPatcher.EnsurePosDeviceSetupRulesTableAsync(db);

        var q = db.PosDeviceSetupRules.AsNoTracking()
            .Where(r => r.CompanyId == companyId);

        if (!includeInactive)
            q = q.Where(r => r.Active);

        if (!string.IsNullOrWhiteSpace(locationExternalId))
        {
            var loc = locationExternalId.Trim();
            q = q.Where(r => r.LocationExternalId == loc || r.LocationExternalId == string.Empty);
        }

        var rows = await q
            .OrderBy(r => r.Sequence)
            .ThenBy(r => r.ProductCategory)
            .ThenBy(r => r.ProductGroup)
            .ThenBy(r => r.ProductName)
            .ThenBy(r => r.Id)
            .ToListAsync(cancellationToken);

        var deviceIds = rows
            .SelectMany(r => new[] { r.PrimaryDeviceId, r.SecondaryDeviceId, r.ConcurrentDeviceId })
            .Where(id => id is int and > 0)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var devices = deviceIds.Count == 0
            ? new Dictionary<int, PosDevice>()
            : await db.PosDevices.AsNoTracking()
                .Where(d => deviceIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, cancellationToken);

        var typeCatalog = await LoadDeviceTypeCatalogAsync(companyId, cancellationToken);
        return Ok(rows.Select(r => Map(r, devices, typeCatalog)));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] UpsertRequest body,
        CancellationToken cancellationToken = default)
    {
        var error = await ValidateAsync(body, excludeId: null, cancellationToken);
        if (error is not null)
            return BadRequest(new { message = error });

        await SchemaPatcher.EnsurePosDeviceSetupRulesTableAsync(db);

        var now = DateTime.UtcNow;
        var productName = await ResolveProductNameAsync(body, cancellationToken);
        var row = new PosDeviceSetupRule
        {
            CompanyId = body.CompanyId,
            LocationExternalId = (body.LocationExternalId ?? string.Empty).Trim(),
            ProductCategory = (body.ProductCategory ?? string.Empty).Trim(),
            ProductGroup = (body.ProductGroup ?? string.Empty).Trim(),
            ProductId = body.ProductId is int pid && pid > 0 ? pid : null,
            ProductName = productName,
            PrimaryDeviceId = NormalizeDeviceId(body.PrimaryDeviceId),
            SecondaryDeviceId = NormalizeDeviceId(body.SecondaryDeviceId),
            ConcurrentDeviceId = NormalizeDeviceId(body.ConcurrentDeviceId),
            PrimaryDeviceType = NormalizeDeviceId(body.PrimaryDeviceId) is null
                ? NormalizeDeviceType(body.PrimaryDeviceType)
                : string.Empty,
            SecondaryDeviceType = NormalizeDeviceId(body.SecondaryDeviceId) is null
                ? NormalizeDeviceType(body.SecondaryDeviceType)
                : string.Empty,
            ConcurrentDeviceType = NormalizeDeviceId(body.ConcurrentDeviceId) is null
                ? NormalizeDeviceType(body.ConcurrentDeviceType)
                : string.Empty,
            Sequence = Math.Max(0, body.Sequence),
            Active = body.Active,
            CreatedAt = now,
            UpdatedAt = now,
        };

        db.PosDeviceSetupRules.Add(row);
        await db.SaveChangesAsync(cancellationToken);

        var devices = await LoadDevicesAsync(row, cancellationToken);
        var typeCatalog = await LoadDeviceTypeCatalogAsync(row.CompanyId, cancellationToken);
        return Ok(Map(row, devices, typeCatalog));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(
        int id,
        [FromBody] UpsertRequest body,
        CancellationToken cancellationToken = default)
    {
        await SchemaPatcher.EnsurePosDeviceSetupRulesTableAsync(db);

        var row = await db.PosDeviceSetupRules.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound();

        if (body.CompanyId != row.CompanyId)
            return BadRequest(new { message = "companyId cannot be changed." });

        var error = await ValidateAsync(body, excludeId: id, cancellationToken);
        if (error is not null)
            return BadRequest(new { message = error });

        row.LocationExternalId = (body.LocationExternalId ?? string.Empty).Trim();
        row.ProductCategory = (body.ProductCategory ?? string.Empty).Trim();
        row.ProductGroup = (body.ProductGroup ?? string.Empty).Trim();
        row.ProductId = body.ProductId is int pid && pid > 0 ? pid : null;
        row.ProductName = await ResolveProductNameAsync(body, cancellationToken);
        row.PrimaryDeviceId = NormalizeDeviceId(body.PrimaryDeviceId);
        row.SecondaryDeviceId = NormalizeDeviceId(body.SecondaryDeviceId);
        row.ConcurrentDeviceId = NormalizeDeviceId(body.ConcurrentDeviceId);
        row.PrimaryDeviceType = row.PrimaryDeviceId is null
            ? NormalizeDeviceType(body.PrimaryDeviceType)
            : string.Empty;
        row.SecondaryDeviceType = row.SecondaryDeviceId is null
            ? NormalizeDeviceType(body.SecondaryDeviceType)
            : string.Empty;
        row.ConcurrentDeviceType = row.ConcurrentDeviceId is null
            ? NormalizeDeviceType(body.ConcurrentDeviceType)
            : string.Empty;
        row.Sequence = Math.Max(0, body.Sequence);
        row.Active = body.Active;
        row.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        var devices = await LoadDevicesAsync(row, cancellationToken);
        var typeCatalog = await LoadDeviceTypeCatalogAsync(row.CompanyId, cancellationToken);
        return Ok(Map(row, devices, typeCatalog));
    }

    [HttpPatch("{id:int}/active")]
    public async Task<ActionResult<object>> SetActive(
        int id,
        [FromBody] ActiveBody body,
        CancellationToken cancellationToken = default)
    {
        await SchemaPatcher.EnsurePosDeviceSetupRulesTableAsync(db);

        var row = await db.PosDeviceSetupRules.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound();

        row.Active = body.Active;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        var devices = await LoadDevicesAsync(row, cancellationToken);
        var typeCatalog = await LoadDeviceTypeCatalogAsync(row.CompanyId, cancellationToken);
        return Ok(Map(row, devices, typeCatalog));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken = default)
    {
        await SchemaPatcher.EnsurePosDeviceSetupRulesTableAsync(db);

        var row = await db.PosDeviceSetupRules.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound();

        db.PosDeviceSetupRules.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    async Task<string?> ValidateAsync(UpsertRequest body, int? excludeId, CancellationToken cancellationToken)
    {
        if (body.CompanyId <= 0)
            return "companyId is required.";

        var primaryType = NormalizeDeviceType(body.PrimaryDeviceType);
        var secondaryType = NormalizeDeviceType(body.SecondaryDeviceType);
        var concurrentType = NormalizeDeviceType(body.ConcurrentDeviceType);

        var hasDevice = body.PrimaryDeviceId is > 0
            || body.SecondaryDeviceId is > 0
            || body.ConcurrentDeviceId is > 0;
        var hasType = primaryType.Length > 0
            || secondaryType.Length > 0
            || concurrentType.Length > 0;

        if (!hasDevice && !hasType)
            return "Select at least one device or device type (Primary, Secondary, or Concurrent).";

        foreach (var (label, deviceId) in new[]
                 {
                     ("Primary", body.PrimaryDeviceId),
                     ("Secondary", body.SecondaryDeviceId),
                     ("Concurrent", body.ConcurrentDeviceId),
                 })
        {
            if (deviceId is not int id || id <= 0)
                continue;
            var device = await db.PosDevices.AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == id && d.CompanyId == body.CompanyId, cancellationToken);
            if (device is null)
                return $"{label} device #{id} was not found for this company.";
            if (!device.Active)
                return $"{label} device “{device.Name}” is inactive.";
        }

        var typeCatalog = await LoadDeviceTypeCatalogAsync(body.CompanyId, cancellationToken);
        foreach (var (label, typeCode) in new[]
                 {
                     ("Primary", primaryType),
                     ("Secondary", secondaryType),
                     ("Concurrent", concurrentType),
                 })
        {
            if (typeCode.Length == 0)
                continue;
            if (!typeCatalog.ContainsKey(typeCode))
                return $"{label} device type “{typeCode}” was not found. Add it under Device Types first.";
            if (!typeCatalog[typeCode].Active)
                return $"{label} device type “{typeCatalog[typeCode].Name}” is inactive.";
        }

        if (body.ProductId is int productId && productId > 0)
        {
            var product = await db.Products.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == productId && p.CompanyId == body.CompanyId, cancellationToken);
            if (product is null)
                return $"Product #{productId} was not found for this company.";
        }

        // Prevent exact duplicate scopes for the same company/location.
        var loc = (body.LocationExternalId ?? string.Empty).Trim();
        var cat = (body.ProductCategory ?? string.Empty).Trim();
        var group = (body.ProductGroup ?? string.Empty).Trim();
        int? pid = body.ProductId is int p && p > 0 ? p : null;

        var clash = await db.PosDeviceSetupRules.AsNoTracking().AnyAsync(r =>
                r.CompanyId == body.CompanyId
                && r.LocationExternalId == loc
                && r.ProductCategory == cat
                && r.ProductGroup == group
                && r.ProductId == pid
                && (excludeId == null || r.Id != excludeId.Value),
            cancellationToken);
        if (clash)
            return "A device set up rule already exists for this category / group / product scope.";

        return null;
    }

    async Task<string> ResolveProductNameAsync(UpsertRequest body, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(body.ProductName))
            return body.ProductName.Trim();
        if (body.ProductId is not int id || id <= 0)
            return string.Empty;
        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        return product?.Name?.Trim() ?? string.Empty;
    }

    async Task<Dictionary<int, PosDevice>> LoadDevicesAsync(
        PosDeviceSetupRule row,
        CancellationToken cancellationToken)
    {
        var ids = new[] { row.PrimaryDeviceId, row.SecondaryDeviceId, row.ConcurrentDeviceId }
            .Where(id => id is int and > 0)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        if (ids.Count == 0)
            return new Dictionary<int, PosDevice>();
        return await db.PosDevices.AsNoTracking()
            .Where(d => ids.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, cancellationToken);
    }

    async Task<Dictionary<string, (string Name, bool Active)>> LoadDeviceTypeCatalogAsync(
        int companyId,
        CancellationToken cancellationToken)
    {
        var rows = await db.PosConfigTypes.AsNoTracking()
            .Where(r => r.CompanyId == companyId && r.Kind == "device")
            .Select(r => new { r.Code, r.Name, r.Active })
            .ToListAsync(cancellationToken);

        var map = new Dictionary<string, (string Name, bool Active)>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            var code = (row.Code ?? string.Empty).Trim();
            if (code.Length == 0) continue;
            map[code] = ((row.Name ?? code).Trim(), row.Active);
        }
        return map;
    }

    static int? NormalizeDeviceId(int? id) => id is int v && v > 0 ? v : null;

    static string NormalizeDeviceType(string? raw) => (raw ?? string.Empty).Trim();

    static object Map(
        PosDeviceSetupRule row,
        IReadOnlyDictionary<int, PosDevice> devices,
        IReadOnlyDictionary<string, (string Name, bool Active)> typeCatalog)
    {
        static object? DeviceRef(int? id, IReadOnlyDictionary<int, PosDevice> map)
        {
            if (id is not int deviceId || deviceId <= 0)
                return null;
            if (!map.TryGetValue(deviceId, out var d))
                return new { id = deviceId, name = $"Device #{deviceId}", deviceType = string.Empty };
            return new
            {
                id = d.Id,
                name = d.Name,
                deviceType = d.DeviceType,
                locationExternalId = d.LocationExternalId,
                active = d.Active,
            };
        }

        static object? TypeRef(
            string typeCode,
            IReadOnlyDictionary<string, (string Name, bool Active)> catalog)
        {
            if (string.IsNullOrWhiteSpace(typeCode))
                return null;
            if (!catalog.TryGetValue(typeCode, out var entry))
                return new { code = typeCode, name = typeCode, active = false };
            return new { code = typeCode, name = entry.Name, active = entry.Active };
        }

        return new
        {
            id = row.Id,
            companyId = row.CompanyId,
            locationExternalId = row.LocationExternalId,
            productCategory = row.ProductCategory,
            productGroup = row.ProductGroup,
            productId = row.ProductId,
            productName = row.ProductName,
            primaryDeviceId = row.PrimaryDeviceId,
            secondaryDeviceId = row.SecondaryDeviceId,
            concurrentDeviceId = row.ConcurrentDeviceId,
            primaryDeviceType = row.PrimaryDeviceType,
            secondaryDeviceType = row.SecondaryDeviceType,
            concurrentDeviceType = row.ConcurrentDeviceType,
            primaryDevice = DeviceRef(row.PrimaryDeviceId, devices)
                ?? TypeRefAsDevice(row.PrimaryDeviceType, typeCatalog),
            secondaryDevice = DeviceRef(row.SecondaryDeviceId, devices)
                ?? TypeRefAsDevice(row.SecondaryDeviceType, typeCatalog),
            concurrentDevice = DeviceRef(row.ConcurrentDeviceId, devices)
                ?? TypeRefAsDevice(row.ConcurrentDeviceType, typeCatalog),
            primaryDeviceTypeRef = TypeRef(row.PrimaryDeviceType, typeCatalog),
            secondaryDeviceTypeRef = TypeRef(row.SecondaryDeviceType, typeCatalog),
            concurrentDeviceTypeRef = TypeRef(row.ConcurrentDeviceType, typeCatalog),
            sequence = row.Sequence,
            active = row.Active,
            createdAt = row.CreatedAt,
            updatedAt = row.UpdatedAt,
        };

        static object? TypeRefAsDevice(
            string typeCode,
            IReadOnlyDictionary<string, (string Name, bool Active)> catalog)
        {
            if (string.IsNullOrWhiteSpace(typeCode))
                return null;
            if (!catalog.TryGetValue(typeCode, out var entry))
                return new { id = 0, name = typeCode, deviceType = typeCode, active = false };
            return new
            {
                id = 0,
                name = entry.Name,
                deviceType = typeCode,
                active = entry.Active,
            };
        }
    }
}
