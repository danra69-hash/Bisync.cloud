using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/cashpurchases")]
public class CashPurchasesController(
    BisyncDbContext db,
    LocationPartitionService locationPartitions,
    SplitUseService splitUse,
    FifoBatchIssueService fifoBatches) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId)
    {
        IQueryable<CashPurchase> query = db.CashPurchases.AsNoTracking();
        if (companyId is int id)
            query = query.Where(p => p.CompanyId == id);

        var rows = await query
            .OrderByDescending(p => p.DatePurchased)
            .ThenByDescending(p => p.Id)
            .Take(100)
            .ToListAsync();

        return Ok(rows.Select(MapCashPurchase));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateCashPurchaseRequest request)
    {
        var storeName = request.StoreName?.Trim() ?? string.Empty;
        var componentId = request.ComponentId?.Trim() ?? string.Empty;
        var storeProductName = request.StoreProductName?.Trim() ?? string.Empty;
        var deliveryUnit = request.DeliveryUnit?.Trim() ?? string.Empty;
        var componentUom = request.ComponentUom?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(storeName))
            return BadRequest(new { message = "Store name is required." });
        if (string.IsNullOrWhiteSpace(componentId))
            return BadRequest(new { message = "Component is required." });
        if (string.IsNullOrWhiteSpace(storeProductName))
            return BadRequest(new { message = "Store product name is required." });
        if (string.IsNullOrWhiteSpace(deliveryUnit))
            return BadRequest(new { message = "Delivery unit is required." });
        if (string.IsNullOrWhiteSpace(componentUom))
            return BadRequest(new { message = "Component UOM is required." });
        if (request.Quantity <= 0)
            return BadRequest(new { message = "Quantity must be greater than zero." });
        if (request.DeliveryPrice < 0)
            return BadRequest(new { message = "Delivery price cannot be negative." });

        var ingredient = await db.Ingredients
            .FirstOrDefaultAsync(i => i.ComponentId == componentId && i.Active);
        if (ingredient is null)
            return BadRequest(new { message = "Selected component was not found." });

        var componentName = string.IsNullOrWhiteSpace(request.ComponentName)
            ? ingredient.Name
            : request.ComponentName.Trim();

        var locationIds = (request.LocationExternalIds ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var locationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(locationIds);
        var locationExternalId = locationIds.Count > 0
            ? locationIds[0].Trim().ToLowerInvariant()
            : string.Empty;

        if (!string.IsNullOrEmpty(locationExternalId))
            await locationPartitions.EnsurePartitionsForLocationAsync(locationExternalId);

        // DeliveryPrice is the PO/cash line amount; Quantity is the entered delivery/stock qty.
        // Principal unit price is derived once as round4(lineAmount ÷ principalQty) inside the bridge.
        var unitCost = request.Quantity > 0
            ? request.DeliveryPrice / request.Quantity
            : request.DeliveryPrice;

        var stockQty = request.Quantity;
        var stockUom = componentUom;
        var inbound = IngredientUomBridge.ToInboundPrincipal(
            ingredient,
            request.Quantity,
            componentUom,
            unitCost,
            vendorProductId: null,
            deliveryUom: deliveryUnit);
        stockQty = inbound.Quantity;
        stockUom = inbound.Uom;
        unitCost = inbound.UnitPrice;

        var receiptBase64 = request.ReceiptFileBase64?.Trim() ?? string.Empty;
        if (receiptBase64.Length > 2_000_000)
            return BadRequest(new { message = "Receipt attachment is too large (max ~1.5 MB)." });

        var cashPurchase = new CashPurchase
        {
            DatePurchased = request.DatePurchased,
            StoreName = storeName,
            ComponentId = componentId,
            ComponentName = componentName,
            StoreProductName = storeProductName,
            DeliveryUnit = deliveryUnit,
            DeliveryPrice = request.DeliveryPrice,
            Quantity = request.Quantity,
            ComponentUom = componentUom,
            ReceiptNumber = request.ReceiptNumber?.Trim() ?? string.Empty,
            ReceiptFileName = request.ReceiptFileName?.Trim() ?? string.Empty,
            ReceiptFileBase64 = receiptBase64,
            CompanyId = request.CompanyId,
            LocationIdsJson = locationIdsJson,
            CreatedAt = DateTime.UtcNow,
        };

        db.CashPurchases.Add(cashPurchase);
        await using var transaction = await db.Database.BeginTransactionAsync();
        InventoryPurchase inventoryPurchase;
        try
        {
            // Reserve the cash purchase ID so all generated rows share an auditable source.
            await db.SaveChangesAsync();

            if (splitUse.ReadConfig(ingredient) is not null)
            {
                var posting = await splitUse.PostInboundAsync(
                    ingredient,
                    stockQty,
                    stockUom,
                    unitCost,
                    request.DatePurchased,
                    cashPurchase.CreatedAt,
                    0,
                    0,
                    request.CompanyId,
                    locationIdsJson,
                    locationExternalId,
                    "cash-purchase",
                    cashPurchase.Id,
                    remarks: null,
                    documentAmount: inbound.DocumentAmount,
                    roundingResidual: inbound.RoundingResidual);
                inventoryPurchase = posting.ParentPurchase;
            }
            else
            {
                inventoryPurchase = new InventoryPurchase
                {
                    ComponentId = componentId,
                    ComponentName = componentName,
                    Quantity = stockQty,
                    Uom = stockUom,
                    UnitPrice = unitCost,
                    DocumentAmount = inbound.DocumentAmount,
                    RoundingResidual = inbound.RoundingResidual,
                    DateOrdered = request.DatePurchased,
                    DateCreatedInStock = cashPurchase.CreatedAt,
                    PurchaseOrderId = 0,
                    PurchaseOrderItemId = 0,
                    CompanyId = request.CompanyId,
                    LocationIdsJson = locationIdsJson,
                    LocationExternalId = locationExternalId,
                };
                db.InventoryPurchases.Add(inventoryPurchase);
                ingredient.LastPriceRecipe = unitCost;
                if (ingredient.InventoryUom.Equals(stockUom, StringComparison.OrdinalIgnoreCase)
                    || ingredient.RecipeUom.Equals(ingredient.InventoryUom, StringComparison.OrdinalIgnoreCase))
                    ingredient.LastPriceInventory = unitCost;
                else if (IngredientUomBridge.TryConvertToUom(
                             ingredient,
                             1m,
                             unitCost,
                             stockUom,
                             ingredient.InventoryUom,
                             out _,
                             out var inventoryUnitCost))
                    ingredient.LastPriceInventory = inventoryUnitCost;
            }

            await db.SaveChangesAsync();
            cashPurchase.InventoryPurchaseId = inventoryPurchase.Id;
            await db.SaveChangesAsync();

            // Guide step 1: each inbound shipment becomes a distinct cost-segregated batch.
            var receiptPurchases = await db.InventoryPurchases
                .Where(p => p.Id == inventoryPurchase.Id
                    || (p.SplitSourceType == "cash-purchase" && p.SplitSourceId == cashPurchase.Id))
                .ToListAsync();
            foreach (var purchase in receiptPurchases)
                await fifoBatches.RecordReceiptFromPurchaseAsync(purchase);

            await transaction.CommitAsync();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        return Ok(new
        {
            cashPurchase = MapCashPurchase(cashPurchase),
            inventoryPurchase = new
            {
                inventoryPurchase.Id,
                componentId = inventoryPurchase.ComponentId,
                componentName = inventoryPurchase.ComponentName,
                quantity = inventoryPurchase.Quantity,
                uom = inventoryPurchase.Uom,
                unitPrice = inventoryPurchase.UnitPrice,
                dateOrdered = inventoryPurchase.DateOrdered,
                dateCreatedInStock = inventoryPurchase.DateCreatedInStock,
                purchaseOrderId = inventoryPurchase.PurchaseOrderId,
                companyId = inventoryPurchase.CompanyId,
                locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(inventoryPurchase.LocationIdsJson),
                splitSourceType = inventoryPurchase.SplitSourceType,
                splitSourceId = inventoryPurchase.SplitSourceId,
                splitLineKey = inventoryPurchase.SplitLineKey,
                splitParentComponentId = inventoryPurchase.SplitParentComponentId,
            },
        });
    }

    static object MapCashPurchase(CashPurchase purchase) => new
    {
        purchase.Id,
        datePurchased = purchase.DatePurchased,
        storeName = purchase.StoreName,
        componentId = purchase.ComponentId,
        componentName = purchase.ComponentName,
        storeProductName = purchase.StoreProductName,
        deliveryUnit = purchase.DeliveryUnit,
        deliveryPrice = purchase.DeliveryPrice,
        quantity = purchase.Quantity,
        componentUom = purchase.ComponentUom,
        receiptNumber = purchase.ReceiptNumber,
        receiptFileName = purchase.ReceiptFileName,
        hasReceiptAttachment = !string.IsNullOrWhiteSpace(purchase.ReceiptFileBase64),
        inventoryPurchaseId = purchase.InventoryPurchaseId,
        companyId = purchase.CompanyId,
        locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(purchase.LocationIdsJson),
        createdAt = purchase.CreatedAt,
    };
}
