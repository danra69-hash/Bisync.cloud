using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class ProductBomChangeRecorder
{
    public const string LineKindRecipe = "recipe";
    public const string LineKindPackaging = "packaging";
    public const string ChangeIn = "component_in";
    public const string ChangeOut = "component_out";
    public const string ChangeQty = "quantity_adjustment";

    public sealed record BomLineSnapshot(
        string ComponentId,
        string ComponentName,
        string ComponentUom,
        decimal Quantity,
        decimal UnitPrice);

    public static List<ProductBomChange> Diff(
        Product product,
        string lineKind,
        IReadOnlyList<BomLineSnapshot> before,
        IReadOnlyList<BomLineSnapshot> after,
        int? userId,
        string userEmail,
        string userName,
        DateTime changedAt)
    {
        var changes = new List<ProductBomChange>();
        var beforeBag = before
            .Where(l => !string.IsNullOrWhiteSpace(l.ComponentId))
            .Select(Normalize)
            .ToList();
        var afterBag = after
            .Where(l => !string.IsNullOrWhiteSpace(l.ComponentId))
            .Select(Normalize)
            .ToList();

        var beforeById = beforeBag.GroupBy(l => l.ComponentId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);
        var afterById = afterBag.GroupBy(l => l.ComponentId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.OrdinalIgnoreCase);

        foreach (var (componentId, oldLines) in beforeById)
        {
            afterById.TryGetValue(componentId, out var newLines);
            newLines ??= [];

            var paired = Math.Min(oldLines.Count, newLines.Count);
            for (var i = 0; i < paired; i++)
            {
                var oldLine = oldLines[i];
                var newLine = newLines[i];
                if (SameLine(oldLine, newLine))
                    continue;

                changes.Add(Create(
                    product, lineKind, userId, userEmail, userName, changedAt,
                    ChangeQty,
                    componentId,
                    newLine.ComponentName,
                    oldLine,
                    newLine,
                    DescribeAdjustment(oldLine, newLine)));
            }

            for (var i = paired; i < oldLines.Count; i++)
            {
                var oldLine = oldLines[i];
                changes.Add(Create(
                    product, lineKind, userId, userEmail, userName, changedAt,
                    ChangeOut,
                    oldLine.ComponentId,
                    oldLine.ComponentName,
                    oldLine,
                    null,
                    $"Removed {oldLine.ComponentName} ({oldLine.ComponentId})"));
            }

            for (var i = paired; i < newLines.Count; i++)
            {
                var newLine = newLines[i];
                changes.Add(Create(
                    product, lineKind, userId, userEmail, userName, changedAt,
                    ChangeIn,
                    newLine.ComponentId,
                    newLine.ComponentName,
                    null,
                    newLine,
                    $"Added {newLine.ComponentName} ({newLine.ComponentId})"));
            }
        }

        foreach (var (componentId, newLines) in afterById)
        {
            if (beforeById.ContainsKey(componentId))
                continue;

            foreach (var newLine in newLines)
            {
                changes.Add(Create(
                    product, lineKind, userId, userEmail, userName, changedAt,
                    ChangeIn,
                    newLine.ComponentId,
                    newLine.ComponentName,
                    null,
                    newLine,
                    $"Added {newLine.ComponentName} ({newLine.ComponentId})"));
            }
        }

        return changes;
    }

    public static async Task<(int? UserId, string Email, string Name)> ResolveActorAsync(
        BisyncDbContext db,
        HttpContext? http,
        CancellationToken ct = default)
    {
        if (http is null)
            return (null, string.Empty, string.Empty);

        if (!int.TryParse(http.Request.Headers[TenantContextMiddleware.UserHeader].FirstOrDefault(), out var userId)
            || userId <= 0)
            return (null, string.Empty, string.Empty);

        var user = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return (userId, string.Empty, string.Empty);

        return (userId, user.Email ?? string.Empty, user.FullName ?? string.Empty);
    }

    static BomLineSnapshot Normalize(BomLineSnapshot line) =>
        line with
        {
            ComponentId = line.ComponentId.Trim(),
            ComponentName = line.ComponentName.Trim(),
            ComponentUom = line.ComponentUom.Trim(),
        };

    static bool SameLine(BomLineSnapshot a, BomLineSnapshot b) =>
        string.Equals(a.ComponentUom, b.ComponentUom, StringComparison.OrdinalIgnoreCase)
        && a.Quantity == b.Quantity;

    static string DescribeAdjustment(BomLineSnapshot oldLine, BomLineSnapshot newLine)
    {
        var parts = new List<string>();
        if (!string.Equals(oldLine.ComponentUom, newLine.ComponentUom, StringComparison.OrdinalIgnoreCase))
            parts.Add($"UOM {oldLine.ComponentUom} → {newLine.ComponentUom}");
        if (oldLine.Quantity != newLine.Quantity)
            parts.Add($"Qty {oldLine.Quantity} → {newLine.Quantity}");
        return parts.Count > 0
            ? string.Join("; ", parts)
            : "Line adjusted";
    }

    static ProductBomChange Create(
        Product product,
        string lineKind,
        int? userId,
        string userEmail,
        string userName,
        DateTime changedAt,
        string changeType,
        string componentId,
        string componentName,
        BomLineSnapshot? oldLine,
        BomLineSnapshot? newLine,
        string note) =>
        new()
        {
            ProductId = product.Id,
            ProductCode = product.ProductId,
            ProductName = product.Name,
            CompanyId = product.CompanyId,
            LineKind = lineKind,
            ChangeType = changeType,
            ComponentId = componentId,
            ComponentName = componentName,
            OldComponentId = oldLine?.ComponentId,
            OldComponentName = oldLine?.ComponentName,
            OldComponentUom = oldLine?.ComponentUom,
            OldQuantity = oldLine?.Quantity,
            OldUnitPrice = oldLine is null ? null : DecimalRounding.ToDb(oldLine.UnitPrice),
            NewComponentId = newLine?.ComponentId,
            NewComponentName = newLine?.ComponentName,
            NewComponentUom = newLine?.ComponentUom,
            NewQuantity = newLine?.Quantity,
            NewUnitPrice = newLine is null ? null : DecimalRounding.ToDb(newLine.UnitPrice),
            ChangedByUserId = userId,
            ChangedByEmail = userEmail,
            ChangedByName = userName,
            ChangedAt = changedAt,
            Note = note,
        };
}
