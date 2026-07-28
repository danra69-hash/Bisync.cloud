using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController(
    BisyncDbContext db,
    ProductNutrientEstimateService nutrientEstimates,
    NutritionLibrarySyncService nutritionLibrary) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId)
    {
        IQueryable<Product> query = db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases);

        if (companyId is int id)
            query = query.Where(p => p.CompanyId == id);

        var rows = await query
            .OrderByDescending(p => p.UpdatedAt)
            .ThenByDescending(p => p.Id)
            .ToListAsync();

        return Ok(rows.Select(MapProduct));
    }

    /// <summary>
    /// Company-wide product change audit for a calendar month (YYYY-MM).
    /// Unions header field changes and BOM/recipe changes.
    /// </summary>
    [HttpGet("audit")]
    public async Task<ActionResult<object>> Audit(
        [FromQuery] int companyId,
        [FromQuery] string month,
        CancellationToken cancellationToken)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });
        if (string.IsNullOrWhiteSpace(month)
            || !DateOnly.TryParseExact(month.Trim() + "-01", "yyyy-MM-dd", out var monthStart))
            return BadRequest(new { message = "month must be YYYY-MM." });

        var fromUtc = DateTime.SpecifyKind(monthStart.ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        var toUtc = DateTime.SpecifyKind(monthStart.AddMonths(1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);

        var fieldRows = await db.ProductFieldChanges.AsNoTracking()
            .Where(c => c.CompanyId == companyId && c.ChangedAt >= fromUtc && c.ChangedAt < toUtc)
            .OrderByDescending(c => c.ChangedAt)
            .ThenByDescending(c => c.Id)
            .ToListAsync(cancellationToken);

        var bomRows = await db.ProductBomChanges.AsNoTracking()
            .Where(c => c.CompanyId == companyId && c.ChangedAt >= fromUtc && c.ChangedAt < toUtc)
            .OrderByDescending(c => c.ChangedAt)
            .ThenByDescending(c => c.Id)
            .ToListAsync(cancellationToken);

        var rows = fieldRows.Select(MapFieldAuditRow)
            .Concat(bomRows.Select(MapBomAuditRow))
            .OrderByDescending(r => r.EffectiveDate)
            .ThenBy(r => r.ProductName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => r.Changes, StringComparer.OrdinalIgnoreCase)
            .Select(r => new
            {
                productId = r.ProductId,
                productName = r.ProductName,
                changes = r.Changes,
                changesFrom = r.ChangesFrom,
                changesTo = r.ChangesTo,
                effectiveDate = r.EffectiveDate,
            })
            .ToList();

        return Ok(new
        {
            companyId,
            month = monthStart.ToString("yyyy-MM"),
            from = fromUtc,
            to = toUtc,
            count = rows.Count,
            rows,
        });
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id)
    {
        var product = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstOrDefaultAsync(p => p.Id == id);

        return product is null ? NotFound() : Ok(MapProduct(product));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] UpsertProductRequest request)
    {
        var validation = ValidateRequest(request);
        if (validation is not null)
            return BadRequest(new { message = validation });

        var productId = string.IsNullOrWhiteSpace(request.ProductId)
            ? await ProductIdGenerator.GenerateAsync(db, request.Name.Trim(), request.IsSubProduct)
            : request.ProductId.Trim();

        if (await db.Products.AnyAsync(p => p.ProductId == productId))
            return BadRequest(new { message = "Product ID already exists." });

        var items = MapItems(request.Items);
        var packagingItems = MapPackagingItems(request.PackagingItems);
        var product = new Product
        {
            ProductId = productId,
            Name = request.Name.Trim(),
            Category = request.Category?.Trim() ?? string.Empty,
            Group = request.Group?.Trim() ?? string.Empty,
            IsSubProduct = request.IsSubProduct,
            IsVariableProduct = !request.IsSubProduct && request.IsVariableProduct,
            B2cEnabled = request.IsSubProduct ? false : request.B2cEnabled,
            B2bEnabled = request.IsSubProduct ? false : request.B2bEnabled,
            B2bPackageUnit = request.IsSubProduct
                ? "pcs"
                : (string.IsNullOrWhiteSpace(request.B2bPackageUnit) ? "pcs" : request.B2bPackageUnit.Trim()),
            B2bSalesConfigJson = request.IsSubProduct
                ? "{}"
                : (string.IsNullOrWhiteSpace(request.B2bSalesConfigJson) ? "{}" : request.B2bSalesConfigJson),
            Rrp = request.IsSubProduct ? 0 : (request.Rrp ?? 0),
            YieldQuantity = request.IsSubProduct ? (request.YieldQuantity ?? 0) : 0,
            YieldUom = request.IsSubProduct ? (request.YieldUom?.Trim() ?? string.Empty) : string.Empty,
            YieldAltUnitsJson = request.IsSubProduct || request.B2bEnabled
                ? (string.IsNullOrWhiteSpace(request.YieldAltUnitsJson) ? "[]" : request.YieldAltUnitsJson)
                : "[]",
            ExpiryPeriodDays = ResolveExpiryPeriodDays(request),
            ActivationPeriodHours = ResolveActivationPeriodHours(request),
            OrderLockPeriodDays = ResolveOrderLockPeriodDays(request),
            ParStock = request.ParStock ?? 0,
            ParStockUom = request.ParStockUom?.Trim() ?? string.Empty,
            PosEnabled = !request.IsSubProduct
                && request.B2cEnabled
                && (request.Rrp ?? 0) > 0
                && (request.PosEnabled ?? true),
            PosDeliveryUnitsJson = !request.IsSubProduct
                && request.B2cEnabled
                && (request.Rrp ?? 0) > 0
                && (request.PosEnabled ?? true)
                ? """[{"unitKey":"b2c-retail"}]"""
                : "[]",
            Active = request.Active ?? true,
            TotalCost = items.Sum(i => i.Subtotal),
            PackagingCost = packagingItems.Sum(i => i.Subtotal),
            CompanyId = request.CompanyId,
            LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds ?? []),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = items,
            PackagingItems = packagingItems,
        };
        ApplyVariableFields(product, request);
        if (product.IsVariableProduct && product.VariableMode == "combination" && items.Count == 0)
            product.TotalCost = product.VariableMinCost;

        db.Products.Add(product);
        await db.SaveChangesAsync();

        var aliasRows = request.IsSubProduct ? [] : MapAliases(request.Aliases, product.Id);
        if (aliasRows.Count > 0)
        {
            db.ProductAliases.AddRange(aliasRows);
            await db.SaveChangesAsync();
        }

        var (actorId, actorEmail, actorName) = await ProductBomChangeRecorder.ResolveActorAsync(db, HttpContext);
        var afterRecipe = product.Items
            .Select(i => new ProductBomChangeRecorder.BomLineSnapshot(
                i.ComponentId, i.ComponentName, i.ComponentUom, i.Quantity, i.ComponentUomPrice))
            .ToList();
        var afterPackaging = product.PackagingItems
            .Select(i => new ProductBomChangeRecorder.BomLineSnapshot(
                i.ComponentId, i.ComponentName, i.ComponentUom, i.Quantity, i.ComponentUomPrice))
            .ToList();
        var bomChanges = ProductBomChangeRecorder.Diff(
                product, ProductBomChangeRecorder.LineKindRecipe, [], afterRecipe,
                actorId, actorEmail, actorName, product.CreatedAt)
            .Concat(ProductBomChangeRecorder.Diff(
                product, ProductBomChangeRecorder.LineKindPackaging, [], afterPackaging,
                actorId, actorEmail, actorName, product.CreatedAt))
            .ToList();
        db.ProductFieldChanges.Add(ProductFieldChangeRecorder.Created(
            product, actorId, actorEmail, actorName, product.CreatedAt));
        if (bomChanges.Count > 0)
            db.ProductBomChanges.AddRange(bomChanges);
        await db.SaveChangesAsync();
        await nutritionLibrary.EnsureReadyAsync();
        await nutrientEstimates.RecalculateForProductAsync(product.Id);

        product = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstAsync(p => p.Id == product.Id);

        return Ok(MapProduct(product));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(int id, [FromBody] UpsertProductRequest request)
    {
        var validation = ValidateRequest(request);
        if (validation is not null)
            return BadRequest(new { message = validation });

        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound();

        var beforeFields = ProductFieldChangeRecorder.Snapshot(product);
        var beforeRecipe = product.Items
            .Select(i => new ProductBomChangeRecorder.BomLineSnapshot(
                i.ComponentId, i.ComponentName, i.ComponentUom, i.Quantity, i.ComponentUomPrice))
            .ToList();
        var beforePackaging = product.PackagingItems
            .Select(i => new ProductBomChangeRecorder.BomLineSnapshot(
                i.ComponentId, i.ComponentName, i.ComponentUom, i.Quantity, i.ComponentUomPrice))
            .ToList();

        var productId = string.IsNullOrWhiteSpace(request.ProductId)
            ? product.ProductId
            : request.ProductId.Trim();

        if (await db.Products.AnyAsync(p => p.ProductId == productId && p.Id != id))
            return BadRequest(new { message = "Product ID already exists." });

        product.ProductId = productId;
        product.Name = request.Name.Trim();
        product.Category = request.Category?.Trim() ?? string.Empty;
        product.Group = request.Group?.Trim() ?? string.Empty;
        product.IsSubProduct = request.IsSubProduct;
        product.B2cEnabled = request.IsSubProduct ? false : request.B2cEnabled;
        product.B2bEnabled = request.IsSubProduct ? false : request.B2bEnabled;
        ApplyVariableFields(product, request);
        if (!request.IsSubProduct)
        {
            product.B2bPackageUnit = string.IsNullOrWhiteSpace(request.B2bPackageUnit)
                ? product.B2bPackageUnit
                : request.B2bPackageUnit.Trim();
            product.B2bSalesConfigJson = string.IsNullOrWhiteSpace(request.B2bSalesConfigJson)
                ? "{}"
                : request.B2bSalesConfigJson;
        }
        else
        {
            product.B2bPackageUnit = "pcs";
            product.B2bSalesConfigJson = "{}";
        }
        if (request.IsSubProduct)
        {
            product.YieldQuantity = request.YieldQuantity ?? 0;
            product.YieldUom = request.YieldUom?.Trim() ?? string.Empty;
            product.YieldAltUnitsJson = string.IsNullOrWhiteSpace(request.YieldAltUnitsJson) ? "[]" : request.YieldAltUnitsJson;
        }
        else if (request.B2bEnabled)
        {
            product.YieldQuantity = 0;
            product.YieldUom = string.Empty;
            product.YieldAltUnitsJson = string.IsNullOrWhiteSpace(request.YieldAltUnitsJson) ? "[]" : request.YieldAltUnitsJson;
        }
        else
        {
            product.YieldQuantity = 0;
            product.YieldUom = string.Empty;
            product.YieldAltUnitsJson = "[]";
        }
        product.ExpiryPeriodDays = ResolveExpiryPeriodDays(request);
        product.ActivationPeriodHours = ResolveActivationPeriodHours(request);
        product.OrderLockPeriodDays = ResolveOrderLockPeriodDays(request);
        if (request.ParStock.HasValue) product.ParStock = request.ParStock.Value;
        if (request.ParStockUom is not null) product.ParStockUom = request.ParStockUom.Trim();
        if (request.Active.HasValue && product.Active && !request.Active.Value)
        {
            var deactivateError = await DeactivationGuardService.ValidateB2bProductDeactivationAsync(db, product);
            if (deactivateError is not null)
                return Conflict(new { message = deactivateError, code = "product_deactivate_blocked" });
        }
        if (request.Active.HasValue) product.Active = request.Active.Value;
        product.CompanyId = request.CompanyId;
        product.LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds ?? []);
        product.UpdatedAt = DateTime.UtcNow;

        db.ProductComponentItems.RemoveRange(product.Items);
        product.Items = MapItems(request.Items);
        var newTotalCost = product.Items.Sum(i => i.Subtotal);
        if (product.IsVariableProduct && product.VariableMode == "combination" && product.Items.Count == 0)
            newTotalCost = product.VariableMinCost;

        db.ProductPackagingItems.RemoveRange(product.PackagingItems);
        product.PackagingItems = MapPackagingItems(request.PackagingItems);
        var newPackagingCost = product.PackagingItems.Sum(i => i.Subtotal);

        var newRrp = request.IsSubProduct ? 0m : (request.Rrp ?? product.Rrp);
        ProductCogsSnapshot.CaptureIfChanged(product, newTotalCost, newPackagingCost, newRrp);
        product.TotalCost = newTotalCost;
        product.PackagingCost = newPackagingCost;
        product.Rrp = newRrp;

        if (!product.B2cEnabled || product.IsSubProduct || product.Rrp <= 0)
        {
            product.PosEnabled = false;
            product.PosDeliveryUnitsJson = "[]";
        }
        else
        {
            // B2C + RRP is the POS retail channel: honor explicit PosEnabled, otherwise keep/enable.
            if (request.PosEnabled.HasValue)
                product.PosEnabled = request.PosEnabled.Value;
            else if (!product.PosEnabled)
                product.PosEnabled = true;

            if (product.PosEnabled
                && (string.IsNullOrWhiteSpace(product.PosDeliveryUnitsJson)
                    || product.PosDeliveryUnitsJson.Trim() == "[]"))
            {
                product.PosDeliveryUnitsJson = """[{"unitKey":"b2c-retail"}]""";
            }
        }

        db.ProductAliases.RemoveRange(product.Aliases);
        product.Aliases = request.IsSubProduct ? [] : MapAliases(request.Aliases, product.Id);

        var afterRecipe = product.Items
            .Select(i => new ProductBomChangeRecorder.BomLineSnapshot(
                i.ComponentId, i.ComponentName, i.ComponentUom, i.Quantity, i.ComponentUomPrice))
            .ToList();
        var afterPackaging = product.PackagingItems
            .Select(i => new ProductBomChangeRecorder.BomLineSnapshot(
                i.ComponentId, i.ComponentName, i.ComponentUom, i.Quantity, i.ComponentUomPrice))
            .ToList();

        var (actorId, actorEmail, actorName) = await ProductBomChangeRecorder.ResolveActorAsync(db, HttpContext);
        var changedAt = product.UpdatedAt;
        var afterFields = ProductFieldChangeRecorder.Snapshot(product);
        var fieldChanges = ProductFieldChangeRecorder.Diff(
            product, beforeFields, afterFields, actorId, actorEmail, actorName, changedAt);
        if (fieldChanges.Count > 0)
            db.ProductFieldChanges.AddRange(fieldChanges);

        var bomChanges = ProductBomChangeRecorder.Diff(
                product, ProductBomChangeRecorder.LineKindRecipe, beforeRecipe, afterRecipe,
                actorId, actorEmail, actorName, changedAt)
            .Concat(ProductBomChangeRecorder.Diff(
                product, ProductBomChangeRecorder.LineKindPackaging, beforePackaging, afterPackaging,
                actorId, actorEmail, actorName, changedAt))
            .ToList();
        if (bomChanges.Count > 0)
            db.ProductBomChanges.AddRange(bomChanges);

        await db.SaveChangesAsync();
        await nutritionLibrary.EnsureReadyAsync();
        await nutrientEstimates.RecalculateForProductAsync(product.Id);

        product = await db.Products
            .AsNoTracking()
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstAsync(p => p.Id == product.Id);

        return Ok(MapProduct(product));
    }

    [HttpGet("{id:int}/bom-changes")]
    public async Task<ActionResult<IEnumerable<object>>> ListBomChanges(int id, [FromQuery] int take = 200)
    {
        var exists = await db.Products.AsNoTracking().AnyAsync(p => p.Id == id);
        if (!exists)
            return NotFound();

        var limit = Math.Clamp(take, 1, 1000);
        var rows = await db.ProductBomChanges.AsNoTracking()
            .Where(c => c.ProductId == id)
            .OrderByDescending(c => c.ChangedAt)
            .ThenByDescending(c => c.Id)
            .Take(limit)
            .ToListAsync();

        return Ok(rows.Select(MapBomChange));
    }

    [HttpPatch("{id:int}")]
    public async Task<ActionResult<object>> Patch(int id, [FromBody] PatchProductRequest request)
    {
        var product = await db.Products
            .Include(p => p.Items)
            .Include(p => p.PackagingItems)
            .Include(p => p.Aliases)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product is null)
            return NotFound();

        var beforeFields = ProductFieldChangeRecorder.Snapshot(product);

        if (request.PosEnabled.HasValue)
        {
            if (request.PosEnabled.Value)
            {
                if (product.IsSubProduct)
                    return BadRequest(new { message = "POS is not available for sub-products." });
                if (!product.B2cEnabled)
                    return BadRequest(new { message = "POS requires a B2C product." });
                var effectiveRrp = request.Rrp ?? product.Rrp;
                if (effectiveRrp <= 0)
                    return BadRequest(new { message = "Set an RRP before enabling POS." });
            }
            product.PosEnabled = request.PosEnabled.Value;
        }
        if (request.PosDeliveryUnits is not null)
        {
            product.PosDeliveryUnitsJson = JsonSerializer.Serialize(
                request.PosDeliveryUnits
                    .Where(unit => !string.IsNullOrWhiteSpace(unit.UnitKey))
                    .Select(unit => new { unitKey = unit.UnitKey.Trim() })
                    .DistinctBy(unit => unit.unitKey),
                JsonOptions);
        }
        if (request.Active.HasValue && product.Active && !request.Active.Value)
        {
            var deactivateError = await DeactivationGuardService.ValidateB2bProductDeactivationAsync(db, product);
            if (deactivateError is not null)
                return Conflict(new { message = deactivateError, code = "product_deactivate_blocked" });
        }
        if (request.Active.HasValue)
            product.Active = request.Active.Value;
        if (request.Rrp.HasValue)
        {
            ProductCogsSnapshot.CaptureIfChanged(
                product,
                product.TotalCost,
                product.PackagingCost,
                request.Rrp.Value);
            product.Rrp = request.Rrp.Value;
        }
        if (request.LocationExternalIds is not null)
            product.LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds);
        if (request.ParStock.HasValue)
            product.ParStock = request.ParStock.Value;
        if (request.ParStockUom is not null)
            product.ParStockUom = request.ParStockUom.Trim();
        if (request.YieldAltUnitsJson is not null)
            product.YieldAltUnitsJson = string.IsNullOrWhiteSpace(request.YieldAltUnitsJson) ? "[]" : request.YieldAltUnitsJson;

        if (!product.B2cEnabled || product.IsSubProduct || product.Rrp <= 0)
        {
            product.PosEnabled = false;
            product.PosDeliveryUnitsJson = "[]";
        }
        else if (request.PosEnabled == false)
        {
            product.PosEnabled = false;
            product.PosDeliveryUnitsJson = "[]";
        }
        else if (product.PosEnabled
            && (string.IsNullOrWhiteSpace(product.PosDeliveryUnitsJson)
                || product.PosDeliveryUnitsJson.Trim() == "[]"))
        {
            product.PosDeliveryUnitsJson = """[{"unitKey":"b2c-retail"}]""";
        }

        product.UpdatedAt = DateTime.UtcNow;

        var (actorId, actorEmail, actorName) = await ProductBomChangeRecorder.ResolveActorAsync(db, HttpContext);
        var afterFields = ProductFieldChangeRecorder.Snapshot(product);
        var fieldChanges = ProductFieldChangeRecorder.Diff(
            product, beforeFields, afterFields, actorId, actorEmail, actorName, product.UpdatedAt);
        if (fieldChanges.Count > 0)
            db.ProductFieldChanges.AddRange(fieldChanges);

        await db.SaveChangesAsync();

        return Ok(MapProduct(product));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id);
        if (product is null)
            return NotFound();

        db.Products.Remove(product);
        await db.SaveChangesAsync();
        return NoContent();
    }

    static string? ValidateRequest(UpsertProductRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return "Product name is required.";
        if (string.IsNullOrWhiteSpace(request.Category))
            return "Category is required.";
        if (string.IsNullOrWhiteSpace(request.Group))
            return "Group is required.";
        if (request.IsSubProduct && request.IsVariableProduct)
            return "A product cannot be both a Sub-product and a Variable Product.";
        if (request.IsSubProduct)
        {
            if (request.YieldQuantity is null or <= 0)
                return "Sub-product yield quantity must be greater than zero.";
            if (string.IsNullOrWhiteSpace(request.YieldUom))
                return "Sub-product UOM is required.";
            if (request.ExpiryPeriodDays is null or <= 0)
                return "Sub-product expiry period (days) must be greater than zero.";
        }
        else if (!request.B2cEnabled && !request.B2bEnabled)
        {
            return "Select a product type: B2C or B2B.";
        }
        else if (request.B2cEnabled && request.B2bEnabled)
        {
            return "A product must be either B2C or B2B, not both.";
        }
        else if (request.B2bEnabled && (request.ExpiryPeriodDays is null or <= 0))
        {
            return "B2B product expiry period (days) must be greater than zero.";
        }

        if (request.IsVariableProduct)
        {
            var mode = (request.VariableMode ?? string.Empty).Trim();
            if (!string.Equals(mode, "combination", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(mode, "replacement", StringComparison.OrdinalIgnoreCase))
                return "Variable Product mode must be Combination or Replacement.";
            if (string.Equals(mode, "combination", StringComparison.OrdinalIgnoreCase))
            {
                if (request.VariableChoiceQty is null or <= 0)
                    return "Enter the total package quantity for this combination.";
                if (string.IsNullOrWhiteSpace(request.VariableOptionsJson)
                    || request.VariableOptionsJson.Trim() is "{}" or "[]")
                    return "Add at least two products to the combination choice list.";
            }
            else if (request.Items is null || request.Items.Count == 0)
            {
                return "Add base Product Components for replacement Variable Products.";
            }
        }
        else if (request.Items is null || request.Items.Count == 0)
        {
            return "Add at least one smart component to the product.";
        }

        foreach (var item in request.Items ?? [])
        {
            if (string.IsNullOrWhiteSpace(item.ComponentId))
                return "Each line requires a smart component.";
            if (item.Quantity <= 0)
                return "Each line requires a quantity greater than zero.";
            if (item.ComponentUomPrice < 0)
                return "Component UOM price cannot be negative.";
        }

        foreach (var item in request.PackagingItems ?? [])
        {
            if (string.IsNullOrWhiteSpace(item.ComponentId))
                continue;
            if (item.Quantity <= 0)
                return "Each packaging line requires a quantity greater than zero.";
            if (item.ComponentUomPrice < 0)
                return "Packaging component UOM price cannot be negative.";
        }

        return null;
    }

    static void ApplyVariableFields(Product product, UpsertProductRequest request)
    {
        if (request.IsSubProduct || !request.IsVariableProduct)
        {
            product.IsVariableProduct = false;
            product.VariableMode = string.Empty;
            product.VariableChoiceQty = 0;
            product.VariableOptionsJson = "{}";
            product.VariableMinCost = 0;
            product.VariableMaxCost = 0;
            return;
        }

        var mode = string.Equals(request.VariableMode, "replacement", StringComparison.OrdinalIgnoreCase)
            ? "replacement"
            : "combination";
        product.IsVariableProduct = true;
        product.VariableMode = mode;
        product.VariableChoiceQty = mode == "combination" ? Math.Max(0, request.VariableChoiceQty ?? 0) : 0;
        product.VariableOptionsJson = string.IsNullOrWhiteSpace(request.VariableOptionsJson)
            ? "{}"
            : request.VariableOptionsJson.Trim();
        product.VariableMinCost = Math.Max(0, request.VariableMinCost ?? 0);
        product.VariableMaxCost = Math.Max(0, request.VariableMaxCost ?? 0);
    }

    static int ResolveExpiryPeriodDays(UpsertProductRequest request)
    {
        if (!request.IsSubProduct && !request.B2bEnabled)
            return 0;
        return Math.Max(0, request.ExpiryPeriodDays ?? 0);
    }

    static int ResolveActivationPeriodHours(UpsertProductRequest request)
    {
        if (!request.IsSubProduct && !request.B2bEnabled)
            return 0;
        return Math.Max(0, request.ActivationPeriodHours ?? 0);
    }

    static int ResolveOrderLockPeriodDays(UpsertProductRequest request)
    {
        if (request.IsSubProduct || !request.B2bEnabled)
            return 7;
        var days = request.OrderLockPeriodDays ?? 7;
        return Math.Clamp(days, 1, 365);
    }

    static List<ProductComponentItem> MapItems(List<UpsertProductComponentItemRequest> items)
        => items.Select((item, index) =>
        {
            var subtotal = item.Quantity * item.ComponentUomPrice;
            return new ProductComponentItem
            {
                ComponentId = item.ComponentId.Trim(),
                ComponentName = item.ComponentName?.Trim() ?? string.Empty,
                ComponentUom = item.ComponentUom?.Trim() ?? string.Empty,
                ComponentUomPrice = item.ComponentUomPrice,
                Quantity = item.Quantity,
                Subtotal = subtotal,
                SortOrder = index,
            };
        }).ToList();

    static List<ProductPackagingItem> MapPackagingItems(List<UpsertProductComponentItemRequest>? items)
        => (items ?? [])
            .Where(item => !string.IsNullOrWhiteSpace(item.ComponentId))
            .Select((item, index) =>
            {
                var subtotal = item.Quantity * item.ComponentUomPrice;
                return new ProductPackagingItem
                {
                    ComponentId = item.ComponentId.Trim(),
                    ComponentName = item.ComponentName?.Trim() ?? string.Empty,
                    ComponentUom = item.ComponentUom?.Trim() ?? string.Empty,
                    ComponentUomPrice = item.ComponentUomPrice,
                    Quantity = item.Quantity,
                    Subtotal = subtotal,
                    SortOrder = index,
                };
            }).ToList();

    static List<ProductAlias> MapAliases(List<UpsertProductAliasRequest>? aliases, int productId)
        => (aliases ?? [])
            .Select((item, index) => new ProductAlias
            {
                Id = item.Id ?? 0,
                ProductId = productId,
                Name = item.Name.Trim(),
                Rrp = item.Rrp,
                B2bSalesConfigJson = string.IsNullOrWhiteSpace(item.B2bSalesConfigJson) ? "{}" : item.B2bSalesConfigJson.Trim(),
                SortOrder = index,
            })
            .Where(item => !string.IsNullOrWhiteSpace(item.Name))
            .ToList();

    static object MapProduct(Product product) => new
    {
        product.Id,
        productId = product.ProductId,
        name = product.Name,
        category = product.Category,
        group = product.Group,
        isSubProduct = product.IsSubProduct,
        isVariableProduct = product.IsVariableProduct,
        variableMode = product.VariableMode,
        variableChoiceQty = product.VariableChoiceQty,
        variableOptionsJson = product.VariableOptionsJson,
        variableMinCost = product.VariableMinCost,
        variableMaxCost = product.VariableMaxCost,
        b2cEnabled = product.B2cEnabled,
        b2bEnabled = product.B2bEnabled,
        b2bPackageUnit = product.B2bPackageUnit,
        b2bSalesConfigJson = product.B2bSalesConfigJson,
        totalCost = product.TotalCost,
        packagingCost = product.PackagingCost,
        rrp = product.Rrp,
        previousTotalCost = product.PreviousTotalCost,
        previousPackagingCost = product.PreviousPackagingCost,
        previousRrp = product.PreviousRrp,
        yieldQuantity = product.YieldQuantity,
        yieldUom = product.YieldUom,
        yieldAltUnitsJson = product.YieldAltUnitsJson,
        expiryPeriodDays = product.ExpiryPeriodDays,
        activationPeriodHours = product.ActivationPeriodHours,
        orderLockPeriodDays = product.OrderLockPeriodDays > 0 ? product.OrderLockPeriodDays : 7,
        parStock = product.ParStock,
        parStockUom = product.ParStockUom,
        posEnabled = product.PosEnabled,
        posDeliveryUnitsJson = product.PosDeliveryUnitsJson,
        active = product.Active,
        companyId = product.CompanyId,
        locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(product.LocationIdsJson),
        createdAt = product.CreatedAt,
        updatedAt = product.UpdatedAt,
        aliases = product.Aliases
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Id)
            .Select(a => new
            {
                a.Id,
                name = a.Name,
                rrp = a.Rrp,
                b2bSalesConfigJson = a.B2bSalesConfigJson,
                sortOrder = a.SortOrder,
            }),
        items = product.Items
            .OrderBy(i => i.SortOrder)
            .ThenBy(i => i.Id)
            .Select(i => new
            {
                i.Id,
                componentId = i.ComponentId,
                componentName = i.ComponentName,
                componentUom = i.ComponentUom,
                componentUomPrice = i.ComponentUomPrice,
                quantity = i.Quantity,
                subtotal = i.Subtotal,
                sortOrder = i.SortOrder,
            }),
        packagingItems = product.PackagingItems
            .OrderBy(i => i.SortOrder)
            .ThenBy(i => i.Id)
            .Select(i => new
            {
                i.Id,
                componentId = i.ComponentId,
                componentName = i.ComponentName,
                componentUom = i.ComponentUom,
                componentUomPrice = i.ComponentUomPrice,
                quantity = i.Quantity,
                subtotal = i.Subtotal,
                sortOrder = i.SortOrder,
            }),
    };

    static object MapBomChange(ProductBomChange change) => new
    {
        change.Id,
        productId = change.ProductId,
        productCode = change.ProductCode,
        productName = change.ProductName,
        companyId = change.CompanyId,
        lineKind = change.LineKind,
        changeType = change.ChangeType,
        componentId = change.ComponentId,
        componentName = change.ComponentName,
        oldComponentId = change.OldComponentId,
        oldComponentName = change.OldComponentName,
        oldComponentUom = change.OldComponentUom,
        oldQuantity = change.OldQuantity,
        oldUnitPrice = change.OldUnitPrice,
        newComponentId = change.NewComponentId,
        newComponentName = change.NewComponentName,
        newComponentUom = change.NewComponentUom,
        newQuantity = change.NewQuantity,
        newUnitPrice = change.NewUnitPrice,
        changedByUserId = change.ChangedByUserId,
        changedByEmail = change.ChangedByEmail,
        changedByName = change.ChangedByName,
        changedAt = change.ChangedAt,
        note = change.Note,
    };

    sealed record AuditRowDto(
        string ProductId,
        string ProductName,
        string Changes,
        string ChangesFrom,
        string ChangesTo,
        DateTime EffectiveDate);

    static AuditRowDto MapFieldAuditRow(ProductFieldChange change) =>
        new(
            change.ProductCode,
            change.ProductName,
            change.FieldLabel,
            string.IsNullOrWhiteSpace(change.OldValue) ? "—" : change.OldValue,
            string.IsNullOrWhiteSpace(change.NewValue) ? "—" : change.NewValue,
            change.ChangedAt);

    static AuditRowDto MapBomAuditRow(ProductBomChange change)
    {
        var kindLabel = string.Equals(change.LineKind, ProductBomChangeRecorder.LineKindPackaging, StringComparison.OrdinalIgnoreCase)
            ? "Packaging"
            : "Recipe";
        var changeLabel = change.ChangeType switch
        {
            ProductBomChangeRecorder.ChangeIn => $"{kindLabel}: added {change.ComponentName}",
            ProductBomChangeRecorder.ChangeOut => $"{kindLabel}: removed {change.ComponentName}",
            ProductBomChangeRecorder.ChangeQty => $"{kindLabel}: {change.ComponentName}",
            _ => $"{kindLabel}: {change.ComponentName}",
        };

        string FormatLine(string? uom, decimal? qty, decimal? unitPrice)
        {
            if (qty is null && string.IsNullOrWhiteSpace(uom) && unitPrice is null)
                return "—";
            var parts = new List<string>();
            if (qty is not null) parts.Add(qty.Value.ToString("0.####"));
            if (!string.IsNullOrWhiteSpace(uom)) parts.Add(uom!);
            if (unitPrice is not null) parts.Add($"@{unitPrice.Value.ToString("0.####")}");
            return parts.Count > 0 ? string.Join(" ", parts) : "—";
        }

        var from = change.ChangeType == ProductBomChangeRecorder.ChangeIn
            ? "—"
            : FormatLine(change.OldComponentUom, change.OldQuantity, change.OldUnitPrice);
        var to = change.ChangeType == ProductBomChangeRecorder.ChangeOut
            ? "—"
            : FormatLine(change.NewComponentUom, change.NewQuantity, change.NewUnitPrice);

        return new AuditRowDto(
            change.ProductCode,
            change.ProductName,
            changeLabel,
            from,
            to,
            change.ChangedAt);
    }
}
