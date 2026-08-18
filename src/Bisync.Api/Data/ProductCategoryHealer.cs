using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Bisync.Api.Data;

/// <summary>
/// Idempotent heal for known Soft Drink products that were imported under
/// Food / Specialties (or other wrong Category/Group), which hid them from
/// RMS Product List when users filter Beverage / Soft Drinks — including
/// the deactivated list.
/// </summary>
public static class ProductCategoryHealer
{
    static readonly (string ProductId, string Name, string Category, string Group)[] SoftDrinkFixes =
    [
        ("PRD-GINGER-002", "GINGER ALE", "Beverage", "Soft Drinks"),
        ("PRD-GINGER-003", "GINGER ALE MIXIER", "Beverage", "Soft Drinks"),
    ];

    public static async Task<int> ApplyAsync(
        BisyncDbContext db,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        if (!await DatabaseSchemaHelper.TableExistsAsync(db, "Products"))
            return 0;

        var healed = 0;
        foreach (var fix in SoftDrinkFixes)
        {
            var rows = await db.Products
                .Where(p =>
                    p.ProductId == fix.ProductId
                    || p.Name == fix.Name)
                .ToListAsync(cancellationToken);

            foreach (var product in rows)
            {
                var categoryOk = string.Equals(
                    product.Category?.Trim(),
                    fix.Category,
                    StringComparison.OrdinalIgnoreCase);
                var groupOk = string.Equals(
                    product.Group?.Trim(),
                    fix.Group,
                    StringComparison.OrdinalIgnoreCase);
                if (categoryOk && groupOk)
                    continue;

                var fromCategory = product.Category;
                var fromGroup = product.Group;
                product.Category = fix.Category;
                product.Group = fix.Group;
                product.UpdatedAt = DateTime.UtcNow;
                healed++;

                logger?.LogInformation(
                    "Healed product {ProductId} ({Name}) Category/Group {FromCat}/{FromGrp} → {ToCat}/{ToGrp}",
                    product.ProductId,
                    product.Name,
                    fromCategory,
                    fromGroup,
                    fix.Category,
                    fix.Group);
            }
        }

        if (healed > 0)
            await db.SaveChangesAsync(cancellationToken);

        return healed;
    }
}
