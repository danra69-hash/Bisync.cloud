using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pos-product-mappings")]
public class PosProductMappingsController(BisyncDbContext db) : ControllerBase
{
    public record UpsertRequest(
        int CompanyId,
        int ProductId,
        string PluNumber,
        bool Active = true);

    public record ActiveBody(bool Active);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int companyId,
        [FromQuery] bool includeInactive = true,
        CancellationToken cancellationToken = default)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        var q = db.PosProductMappings.AsNoTracking()
            .Where(r => r.CompanyId == companyId);

        if (!includeInactive)
            q = q.Where(r => r.Active);

        var rows = await q
            .OrderBy(r => r.ProductName)
            .ThenBy(r => r.PluNumber)
            .ThenBy(r => r.Id)
            .ToListAsync(cancellationToken);

        return Ok(rows.Select(Map));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] UpsertRequest body,
        CancellationToken cancellationToken = default)
    {
        var error = await ValidateAsync(body, excludeId: null, cancellationToken);
        if (error is not null)
            return BadRequest(new { message = error });

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == body.ProductId, cancellationToken);
        if (product is null)
            return BadRequest(new { message = "Product not found." });

        var now = DateTime.UtcNow;
        var row = new PosProductMapping
        {
            CompanyId = body.CompanyId,
            ProductId = product.Id,
            ProductCode = (product.ProductId ?? string.Empty).Trim(),
            ProductName = (product.Name ?? string.Empty).Trim(),
            PluNumber = NormalizePlu(body.PluNumber),
            Active = body.Active,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.PosProductMappings.Add(row);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(Map(row));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(
        int id,
        [FromBody] UpsertRequest body,
        CancellationToken cancellationToken = default)
    {
        var row = await db.PosProductMappings.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "POS product mapping not found." });
        if (row.CompanyId != body.CompanyId)
            return BadRequest(new { message = "companyId mismatch." });

        var error = await ValidateAsync(body, excludeId: id, cancellationToken);
        if (error is not null)
            return BadRequest(new { message = error });

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == body.ProductId, cancellationToken);
        if (product is null)
            return BadRequest(new { message = "Product not found." });

        row.ProductId = product.Id;
        row.ProductCode = (product.ProductId ?? string.Empty).Trim();
        row.ProductName = (product.Name ?? string.Empty).Trim();
        row.PluNumber = NormalizePlu(body.PluNumber);
        row.Active = body.Active;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(Map(row));
    }

    [HttpPatch("{id:int}/active")]
    public async Task<ActionResult<object>> SetActive(
        int id,
        [FromBody] ActiveBody body,
        CancellationToken cancellationToken = default)
    {
        var row = await db.PosProductMappings.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "POS product mapping not found." });

        row.Active = body.Active;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(Map(row));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id, CancellationToken cancellationToken = default)
    {
        var row = await db.PosProductMappings.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "POS product mapping not found." });

        db.PosProductMappings.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    async Task<string?> ValidateAsync(
        UpsertRequest body,
        int? excludeId,
        CancellationToken cancellationToken)
    {
        if (body.CompanyId <= 0)
            return "companyId is required.";
        if (body.ProductId <= 0)
            return "Select a product.";

        var plu = NormalizePlu(body.PluNumber);
        if (string.IsNullOrWhiteSpace(plu))
            return "PLU / POS product number is required.";
        if (plu.Length > 80)
            return "PLU / POS product number must be 80 characters or fewer.";

        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == body.ProductId, cancellationToken);
        if (product is null)
            return "Product not found.";
        if (product.CompanyId is int pid && pid != body.CompanyId)
            return "Product does not belong to this company.";

        var productClash = await db.PosProductMappings.AnyAsync(
            r => r.CompanyId == body.CompanyId
                && r.ProductId == body.ProductId
                && (excludeId == null || r.Id != excludeId.Value),
            cancellationToken);
        if (productClash)
            return "This product is already mapped to a PLU number.";

        var pluClash = await db.PosProductMappings.AnyAsync(
            r => r.CompanyId == body.CompanyId
                && r.PluNumber.ToLower() == plu.ToLower()
                && (excludeId == null || r.Id != excludeId.Value),
            cancellationToken);
        if (pluClash)
            return $"PLU '{plu}' is already mapped to another product.";

        return null;
    }

    static string NormalizePlu(string? raw) => (raw ?? string.Empty).Trim();

    static object Map(PosProductMapping row) => new
    {
        id = row.Id,
        companyId = row.CompanyId,
        productId = row.ProductId,
        productCode = row.ProductCode,
        productName = row.ProductName,
        pluNumber = row.PluNumber,
        active = row.Active,
        createdAt = row.CreatedAt,
        updatedAt = row.UpdatedAt,
    };
}
