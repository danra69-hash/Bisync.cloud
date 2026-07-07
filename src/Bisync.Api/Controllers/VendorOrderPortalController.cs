using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/vendor-orders")]
public class VendorOrderPortalController(BisyncDbContext db) : ControllerBase
{
    [HttpGet("{token}")]
    public async Task<ActionResult<object>> GetByToken(string token)
    {
        var order = await LoadByTokenAsync(token, tracking: true);
        if (order is null) return NotFound(new { message = "Purchase order link is invalid or has expired." });

        await EnsureShareTokenAsync(order);
        return Ok(await BuildPortalViewAsync(order));
    }

    [HttpPost("{token}/accept")]
    public async Task<ActionResult<object>> Accept(string token, [FromBody] VendorOrderAcceptRequest? request)
    {
        var order = await LoadByTokenAsync(token, tracking: true);
        if (order is null) return NotFound(new { message = "Purchase order link is invalid or has expired." });

        await EnsureShareTokenAsync(order);

        if (order.VendorAcceptedAt is not null)
            return Ok(await BuildPortalViewAsync(order));

        if (!PurchaseOrderWorkflow.CanVendorAccept(order))
            return Conflict(new { message = "This purchase order can no longer be accepted." });

        var acceptedBy = request?.AcceptedBy?.Trim();
        if (string.IsNullOrWhiteSpace(acceptedBy))
            acceptedBy = order.VendorName;

        order.VendorAcceptedAt = DateTime.UtcNow;
        order.VendorAcceptedBy = acceptedBy;

        if (string.Equals(order.DocumentType, PurchaseOrderWorkflow.DocumentTypePo, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(order.Status, PurchaseOrderWorkflow.StatusReceived, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(order.Status, PurchaseOrderWorkflow.StatusReconciled, StringComparison.OrdinalIgnoreCase))
        {
            order.Status = PurchaseOrderWorkflow.StatusAccepted;
        }

        await db.SaveChangesAsync();
        await UserNotificationService.NotifyPurchaseOrderAcceptedAsync(db, order);
        return Ok(await BuildPortalViewAsync(order));
    }

    async Task<PurchaseOrder?> LoadByTokenAsync(string token, bool tracking)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var normalized = token.Trim();
        var query = db.PurchaseOrders
            .Include(p => p.Items)
            .AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(p => p.VendorShareToken == normalized);
    }

    async Task EnsureShareTokenAsync(PurchaseOrder order)
    {
        if (!string.IsNullOrWhiteSpace(order.VendorShareToken)) return;
        order.VendorShareToken = Guid.NewGuid().ToString("N");
        await db.SaveChangesAsync();
    }

    async Task<object> BuildPortalViewAsync(PurchaseOrder order)
    {
        Company? company = null;
        if (order.CompanyId is int companyId)
            company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);

        var locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(order.LocationIdsJson);
        var locations = locationExternalIds.Count == 0
            ? []
            : await db.Locations.AsNoTracking()
                .Where(l => locationExternalIds.Contains(l.ExternalId))
                .ToListAsync();

        var vendor = await db.Vendors.AsNoTracking()
            .FirstOrDefaultAsync(v => v.Name == order.VendorName);

        var documentKind = string.Equals(order.DocumentType, PurchaseOrderWorkflow.DocumentTypePr, StringComparison.OrdinalIgnoreCase)
            ? "purchase_request"
            : "purchase_order";

        return new
        {
            order.Id,
            poNumber = order.PoNumber,
            vendorName = order.VendorName,
            documentType = order.DocumentType,
            documentKind,
            status = order.Status,
            orderDate = order.OrderDate,
            deliveryDate = order.DeliveryDate,
            initiatedBy = order.InitiatedBy,
            approvedBy = order.ApprovedBy,
            vendorAcceptedAt = order.VendorAcceptedAt,
            vendorAcceptedBy = order.VendorAcceptedBy,
            canAccept = PurchaseOrderWorkflow.CanVendorAccept(order),
            company = company is null ? null : new
            {
                company.Name,
                company.Brn,
                company.GstTin,
                company.Phone,
                company.Email,
                addressLine1 = company.AddressLine1,
                addressLine2 = company.AddressLine2,
                company.City,
                stateProvince = company.StateProvince,
                company.Postcode,
            },
            vendor = new
            {
                name = vendor?.Name ?? order.VendorName,
                brn = vendor?.Brn ?? string.Empty,
                address = vendor?.Address ?? string.Empty,
                city = vendor?.City ?? string.Empty,
                state = vendor?.State ?? string.Empty,
                contactPerson = vendor?.ContactPerson ?? string.Empty,
                contactPosition = vendor?.ContactPosition ?? string.Empty,
                mobile = vendor?.Mobile ?? string.Empty,
                email = vendor?.Email ?? string.Empty,
            },
            deliveryLocations = locations.Select(l => new
            {
                l.Name,
                l.ExternalId,
                addressLine1 = string.IsNullOrWhiteSpace(l.AddressLine1) ? l.Address : l.AddressLine1,
                l.AddressLine2,
                l.City,
                stateProvince = l.StateProvince,
                l.Postcode,
            }),
            items = order.Items.Select(i => new
            {
                i.Name,
                deliveryPackage = i.DeliveryPackage,
                quantity = i.Quantity,
                unitPrice = i.UnitPrice,
            }),
        };
    }
}

public class VendorOrderAcceptRequest
{
    public string? AcceptedBy { get; set; }
}
