using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/platform-price-display")]
public class PlatformPriceDisplayController(BisyncDbContext db) : ControllerBase
{
    public const int MinDecimals = 0;
    public const int MaxDecimals = 6;

    public sealed record UpdateRequest(
        int PrincipalUomPriceDecimals,
        int AlternateUomPriceDecimals,
        int VendorDeliveryPriceDecimals);

    [HttpGet]
    public async Task<ActionResult<object>> Get(CancellationToken ct)
    {
        var row = await EnsureAsync(ct);
        var actor = await ResolveActorEmailAsync(ct);
        return Ok(Map(row, SuperAdminAccess.IsPlatformOwnerEmail(actor)));
    }

    [HttpPut]
    public async Task<ActionResult<object>> Update([FromBody] UpdateRequest request, CancellationToken ct)
    {
        var actor = await ResolveActorEmailAsync(ct);
        if (!SuperAdminAccess.IsPlatformOwnerEmail(actor))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Only the platform owner (dra@cubevalue.com) can change price display decimals.",
                code = "platform_owner_required",
            });
        }

        if (!IsValidDecimals(request.PrincipalUomPriceDecimals)
            || !IsValidDecimals(request.AlternateUomPriceDecimals)
            || !IsValidDecimals(request.VendorDeliveryPriceDecimals))
        {
            return BadRequest(new
            {
                message = $"Each decimal setting must be an integer from {MinDecimals} to {MaxDecimals}.",
            });
        }

        var row = await EnsureAsync(ct);
        row.PrincipalUomPriceDecimals = request.PrincipalUomPriceDecimals;
        row.AlternateUomPriceDecimals = request.AlternateUomPriceDecimals;
        row.VendorDeliveryPriceDecimals = request.VendorDeliveryPriceDecimals;
        row.UpdatedAt = DateTime.UtcNow;
        row.UpdatedByEmail = actor;
        await db.SaveChangesAsync(ct);
        return Ok(Map(row, canEdit: true));
    }

    async Task<PlatformPriceDisplaySettings> EnsureAsync(CancellationToken ct)
    {
        var row = await db.PlatformPriceDisplaySettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (row is not null) return row;

        row = new PlatformPriceDisplaySettings
        {
            Id = 1,
            PrincipalUomPriceDecimals = 4,
            AlternateUomPriceDecimals = 2,
            VendorDeliveryPriceDecimals = 2,
            UpdatedAt = DateTime.UtcNow,
            UpdatedByEmail = string.Empty,
        };
        db.PlatformPriceDisplaySettings.Add(row);
        await db.SaveChangesAsync(ct);
        return row;
    }

    async Task<string> ResolveActorEmailAsync(CancellationToken ct)
    {
        if (!int.TryParse(
                Request.Headers[TenantContextMiddleware.UserHeader].FirstOrDefault(),
                out var userId)
            || userId <= 0)
        {
            return string.Empty;
        }

        var email = await db.AppUsers.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync(ct);
        return email ?? string.Empty;
    }

    static bool IsValidDecimals(int value) => value is >= MinDecimals and <= MaxDecimals;

    static object Map(PlatformPriceDisplaySettings row, bool canEdit) => new
    {
        principalUomPriceDecimals = row.PrincipalUomPriceDecimals,
        alternateUomPriceDecimals = row.AlternateUomPriceDecimals,
        vendorDeliveryPriceDecimals = row.VendorDeliveryPriceDecimals,
        updatedAt = row.UpdatedAt,
        updatedByEmail = row.UpdatedByEmail ?? string.Empty,
        canEdit,
        defaults = new
        {
            principalUomPriceDecimals = 4,
            alternateUomPriceDecimals = 2,
            vendorDeliveryPriceDecimals = 2,
        },
    };
}
