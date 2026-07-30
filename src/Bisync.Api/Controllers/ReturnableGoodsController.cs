using System.ComponentModel.DataAnnotations;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/returnable-goods")]
public class ReturnableGoodsController(BisyncDbContext db, ITenantContext tenant) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<object>> GetOverview([FromQuery] int? companyId)
    {
        var cid = TenantQuery.ResolveCompanyId(tenant, companyId);
        if (cid is null && !TenantQuery.AllowsAllCompanies(tenant, cid))
            return Ok(new { ledger = Array.Empty<object>(), summary = Array.Empty<object>(), returns = Array.Empty<object>() });

        var depositQuery = db.PurchaseOrderItems.AsNoTracking()
            .Include(i => i.PurchaseOrder)
            .Where(i => i.IsReturnableDeposit);

        if (cid is int companyFilter)
            depositQuery = depositQuery.Where(i => i.PurchaseOrder != null && i.PurchaseOrder.CompanyId == companyFilter);

        var deposits = await depositQuery
            .OrderByDescending(i => i.PurchaseOrder!.OrderDate)
            .ThenByDescending(i => i.Id)
            .ToListAsync();

        var returnQuery = db.ReturnableGoodsReturns.AsNoTracking().AsQueryable();
        if (cid is int returnCompany)
            returnQuery = returnQuery.Where(r => r.CompanyId == returnCompany);

        var returns = await returnQuery
            .OrderByDescending(r => r.ReturnDate)
            .ThenByDescending(r => r.Id)
            .ToListAsync();

        var ledger = deposits.Select(i =>
        {
            var name = string.IsNullOrWhiteSpace(i.ReturnableItemName) ? i.Name : i.ReturnableItemName;
            return new
            {
                id = i.Id,
                returnableItemName = name,
                uom = i.Unit,
                uomPrice = i.UnitPrice,
                qty = i.Quantity,
                amountTotal = i.Quantity * i.UnitPrice,
                poNumber = i.PurchaseOrder?.PoNumber ?? string.Empty,
                poId = i.PurchaseOrderId,
                orderDate = i.PurchaseOrder?.OrderDate.ToString("yyyy-MM-dd"),
                vendorName = i.PurchaseOrder?.VendorName ?? string.Empty,
                vendorProductId = i.VendorProductId,
            };
        }).ToList();

        var incomingByName = deposits
            .GroupBy(i => (string.IsNullOrWhiteSpace(i.ReturnableItemName) ? i.Name : i.ReturnableItemName).Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    qty = g.Sum(x => x.Quantity),
                    amount = g.Sum(x => x.Quantity * x.UnitPrice),
                    uom = g.Select(x => x.Unit).FirstOrDefault(u => !string.IsNullOrWhiteSpace(u)) ?? string.Empty,
                    unitPrice = g.OrderByDescending(x => x.Id).Select(x => x.UnitPrice).FirstOrDefault(),
                },
                StringComparer.OrdinalIgnoreCase);

        var returnedByName = returns
            .GroupBy(r => r.ReturnableItemName.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    qty = g.Sum(x => x.Quantity),
                    amount = g.Sum(x => x.Amount),
                },
                StringComparer.OrdinalIgnoreCase);

        var names = incomingByName.Keys
            .Concat(returnedByName.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var summary = names.Select(name =>
        {
            incomingByName.TryGetValue(name, out var incoming);
            returnedByName.TryGetValue(name, out var returned);
            var inQty = incoming?.qty ?? 0m;
            var inAmt = incoming?.amount ?? 0m;
            var outQty = returned?.qty ?? 0m;
            var outAmt = returned?.amount ?? 0m;
            return new
            {
                returnableItemName = name,
                uom = incoming?.uom ?? string.Empty,
                unitPrice = incoming?.unitPrice ?? 0m,
                incomingQty = inQty,
                incomingAmount = inAmt,
                returnedQty = outQty,
                returnedAmount = outAmt,
                balanceQty = inQty - outQty,
                balanceAmount = inAmt - outAmt,
            };
        }).ToList();

        return Ok(new
        {
            ledger,
            summary,
            returns = returns.Select(MapReturn),
        });
    }

    [HttpPost("returns")]
    public async Task<ActionResult<object>> CreateReturn([FromBody] CreateReturnableGoodsReturnRequest request)
    {
        var companyId = TenantQuery.ResolveCompanyId(tenant, request.CompanyId);
        if (companyId is null)
            return BadRequest(new { message = "Company is required." });

        var itemName = request.ReturnableItemName?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(itemName))
            return BadRequest(new { message = "Returnable item is required." });
        if (request.Quantity <= 0)
            return BadRequest(new { message = "Quantity returned must be greater than zero." });
        if (string.IsNullOrWhiteSpace(request.CreditNoteNumber))
            return BadRequest(new { message = "Credit note number is required." });
        if (!DateOnly.TryParse(request.ReturnDate, out var returnDate))
            return BadRequest(new { message = "Invalid return date." });
        if (returnDate > DateOnly.FromDateTime(DateTime.UtcNow.Date))
            return BadRequest(new { message = "Return date cannot be in the future." });

        var deposits = await db.PurchaseOrderItems.AsNoTracking()
            .Include(i => i.PurchaseOrder)
            .Where(i => i.IsReturnableDeposit
                && i.PurchaseOrder != null
                && i.PurchaseOrder.CompanyId == companyId)
            .ToListAsync();

        var matching = deposits
            .Where(i => string.Equals(
                (string.IsNullOrWhiteSpace(i.ReturnableItemName) ? i.Name : i.ReturnableItemName).Trim(),
                itemName,
                StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (matching.Count == 0)
            return BadRequest(new { message = $"No incoming deposits found for '{itemName}'." });

        var incomingQty = matching.Sum(i => i.Quantity);
        var alreadyReturned = await db.ReturnableGoodsReturns
            .Where(r => r.CompanyId == companyId
                && r.ReturnableItemName.ToLower() == itemName.ToLower())
            .SumAsync(r => (decimal?)r.Quantity) ?? 0m;
        var balance = incomingQty - alreadyReturned;
        if (request.Quantity > balance + 0.0001m)
            return BadRequest(new { message = $"Return qty exceeds balance ({balance:0.####})." });

        var uom = string.IsNullOrWhiteSpace(request.Uom)
            ? matching.Select(i => i.Unit).FirstOrDefault(u => !string.IsNullOrWhiteSpace(u)) ?? string.Empty
            : request.Uom.Trim();
        var unitPrice = request.UnitPrice > 0
            ? request.UnitPrice
            : matching.OrderByDescending(i => i.Id).Select(i => i.UnitPrice).FirstOrDefault();
        var amount = request.Quantity * unitPrice;

        var entry = new ReturnableGoodsReturn
        {
            CompanyId = companyId,
            ReturnableItemName = itemName,
            Uom = uom,
            UnitPrice = unitPrice,
            Quantity = request.Quantity,
            Amount = amount,
            ReturnDate = returnDate,
            CreditNoteNumber = request.CreditNoteNumber.Trim(),
            CreatedAt = DateTime.UtcNow,
        };

        db.ReturnableGoodsReturns.Add(entry);
        await db.SaveChangesAsync();
        return Ok(MapReturn(entry));
    }

    static object MapReturn(ReturnableGoodsReturn r) => new
    {
        r.Id,
        companyId = r.CompanyId,
        returnableItemName = r.ReturnableItemName,
        uom = r.Uom,
        unitPrice = r.UnitPrice,
        quantity = r.Quantity,
        amount = r.Amount,
        returnDate = r.ReturnDate.ToString("yyyy-MM-dd"),
        creditNoteNumber = r.CreditNoteNumber,
        createdAt = r.CreatedAt,
    };
}

public class CreateReturnableGoodsReturnRequest
{
    public int? CompanyId { get; set; }
    [Required, MaxLength(300)]
    public string ReturnableItemName { get; set; } = string.Empty;
    [Range(0.0001, 999999999)]
    public decimal Quantity { get; set; }
    [MaxLength(50)]
    public string? Uom { get; set; }
    [Range(0, 999999999)]
    public decimal UnitPrice { get; set; }
    [Required]
    public string ReturnDate { get; set; } = string.Empty;
    [Required, MaxLength(100)]
    public string CreditNoteNumber { get; set; } = string.Empty;
}
