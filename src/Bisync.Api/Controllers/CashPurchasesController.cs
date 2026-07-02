using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/cashpurchases")]
public class CashPurchasesController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId)
    {
        IQueryable<CashPurchase> query = db.CashPurchases.AsNoTracking();
        if (companyId is int id)
            query = query.Where(p => p.CompanyId == null || p.CompanyId == id);

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

        var unitCost = request.Quantity > 0
            ? Math.Round(request.DeliveryPrice / request.Quantity, 4, MidpointRounding.AwayFromZero)
            : request.DeliveryPrice;

        var inventoryPurchase = new InventoryPurchase
        {
            ComponentId = componentId,
            ComponentName = componentName,
            Quantity = request.Quantity,
            Uom = componentUom,
            UnitPrice = unitCost,
            DateOrdered = request.DatePurchased,
            DateCreatedInStock = DateTime.UtcNow,
            PurchaseOrderId = 0,
            PurchaseOrderItemId = 0,
            CompanyId = request.CompanyId,
            LocationIdsJson = locationIdsJson,
        };

        db.InventoryPurchases.Add(inventoryPurchase);

        ingredient.LastPriceInventory = unitCost;
        if (ingredient.InventoryUom.Equals(componentUom, StringComparison.OrdinalIgnoreCase)
            && ingredient.RecipeUom.Equals(componentUom, StringComparison.OrdinalIgnoreCase))
        {
            ingredient.LastPriceRecipe = unitCost;
        }

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

        await db.SaveChangesAsync();

        cashPurchase.InventoryPurchaseId = inventoryPurchase.Id;
        db.CashPurchases.Add(cashPurchase);
        await db.SaveChangesAsync();

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
