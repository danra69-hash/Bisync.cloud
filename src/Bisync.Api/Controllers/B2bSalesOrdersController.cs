using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/b2b-sales-orders")]
public class B2bSalesOrdersController(
    BisyncDbContext db,
    B2bSalesOrderService salesOrderService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId, CancellationToken cancellationToken)
    {
        IQueryable<B2bSalesOrder> query = db.B2bSalesOrders.AsNoTracking().Include(o => o.Lines);
        if (companyId is int id)
            query = query.Where(o => o.CompanyId == id);

        var orders = await query
            .OrderByDescending(o => o.UpdatedAt)
            .ThenByDescending(o => o.Id)
            .ToListAsync(cancellationToken);

        return Ok(orders.Select(MapOrder));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateB2bSalesOrderRequest request, CancellationToken cancellationToken)
    {
        if (request.Lines.Count == 0)
            return BadRequest(new { message = "Add at least one order line." });

        var source = B2bSalesOrderService.ValidSources.Contains(request.Source)
            ? request.Source.Trim().ToLowerInvariant()
            : "sales_order";

        var orderNumber = await GenerateOrderNumberAsync(request.CompanyId, cancellationToken);
        var order = new B2bSalesOrder
        {
            CompanyId = request.CompanyId,
            OrderNumber = orderNumber,
            CustomerExternalId = request.CustomerExternalId.Trim(),
            CustomerName = request.CustomerName.Trim(),
            Source = source,
            LockPeriodDays = request.LockPeriodDays,
            Status = "draft",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Lines = request.Lines.Select(line => new B2bSalesOrderLine
            {
                ProductId = line.ProductId,
                LocationExternalId = line.LocationExternalId.Trim(),
                QuantityOrdered = line.QuantityOrdered,
                Uom = line.Uom?.Trim() ?? string.Empty,
                Rrp = line.Rrp ?? 0,
                Status = "open",
            }).ToList(),
        };

        db.B2bSalesOrders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(MapOrder(order));
    }

    [HttpPost("{id:int}/issue")]
    public async Task<ActionResult<object>> Issue(int id, CancellationToken cancellationToken)
    {
        try
        {
            var order = await salesOrderService.IssueAsync(id, cancellationToken);
            return Ok(MapOrder(order));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/fulfill")]
    public async Task<ActionResult<object>> Fulfill(int id, [FromBody] FulfillB2bSalesOrderRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var order = await salesOrderService.FulfillAsync(
                id,
                request.DeliveryOrderIssued,
                request.InvoiceIssued,
                cancellationToken);
            return Ok(MapOrder(order));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("release-expired-locks")]
    public async Task<ActionResult<object>> ReleaseExpiredLocks(CancellationToken cancellationToken)
    {
        var released = await salesOrderService.ReleaseExpiredLocksAsync(cancellationToken);
        return Ok(new { released });
    }

    async Task<string> GenerateOrderNumberAsync(int companyId, CancellationToken cancellationToken)
    {
        var count = await db.B2bSalesOrders.CountAsync(o => o.CompanyId == companyId, cancellationToken);
        return $"SO-{companyId:D3}-{count + 1:D5}";
    }

    static object MapOrder(B2bSalesOrder order) => new
    {
        id = order.Id,
        companyId = order.CompanyId,
        orderNumber = order.OrderNumber,
        customerExternalId = order.CustomerExternalId,
        customerName = order.CustomerName,
        source = order.Source,
        status = order.Status,
        lockPeriodDays = order.LockPeriodDays,
        issuedDate = order.IssuedDate,
        lockExpiryDate = order.LockExpiryDate,
        deliveryOrderIssued = order.DeliveryOrderIssued,
        invoiceIssued = order.InvoiceIssued,
        fulfilledDate = order.FulfilledDate,
        lines = order.Lines.Select(line => new
        {
            id = line.Id,
            productId = line.ProductId,
            productName = line.ProductName,
            locationExternalId = line.LocationExternalId,
            quantityOrdered = line.QuantityOrdered,
            quantityLocked = line.QuantityLocked,
            uom = line.Uom,
            rrp = line.Rrp,
            status = line.Status,
        }),
    };
}
