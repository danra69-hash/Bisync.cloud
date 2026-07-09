using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/dev")]
public class DevSeedController(BisyncDbContext db, IWebHostEnvironment env, B2bSalesOrderService salesOrderService) : ControllerBase
{
    [HttpPost("seed-stock-cards")]
    public async Task<ActionResult<object>> SeedStockCards([FromQuery] int? companyId = 1)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var result = await StockCardDummySeeder.EnsureAsync(db, companyId);
        return Ok(new
        {
            result.Skipped,
            result.Message,
            componentsAdded = result.ComponentsAdded,
            productsAdded = result.ProductsAdded,
            subProductsAdded = result.SubProductsAdded,
            totalAdded = result.TotalAdded,
        });
    }

    [HttpPost("seed-fifo-demo")]
    public async Task<ActionResult<object>> SeedFifoDemo([FromQuery] int? companyId = 1, [FromQuery] bool force = false)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var result = await StockCardFifoDemoSeeder.EnsureAsync(db, companyId ?? 1, force);
        return Ok(result);
    }

    [HttpPost("seed-sales-orders")]
    public async Task<ActionResult<object>> SeedSalesOrders(CancellationToken cancellationToken)
    {
        if (!env.IsDevelopment())
            return NotFound();

        var before = await db.B2bSalesOrders.CountAsync(cancellationToken);
        await B2bSalesOrderSeeder.EnsureDemoSalesOrdersAsync(db, salesOrderService, cancellationToken);
        var after = await db.B2bSalesOrders.CountAsync(cancellationToken);

        return Ok(new
        {
            ordersBefore = before,
            ordersAfter = after,
            ordersAdded = after - before,
        });
    }
}
