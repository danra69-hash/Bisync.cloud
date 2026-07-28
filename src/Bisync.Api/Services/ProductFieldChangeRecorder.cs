using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class ProductFieldChangeRecorder
{
    public sealed record FieldSnapshot(IReadOnlyDictionary<string, string> Values);

    static readonly (string Key, string Label)[] TrackedFields =
    [
        ("ProductCode", "Product ID"),
        ("Name", "Product Name"),
        ("Category", "Category"),
        ("Group", "Group"),
        ("IsSubProduct", "Sub-product"),
        ("IsVariableProduct", "Variable product"),
        ("VariableMode", "Variable mode"),
        ("VariableChoiceQty", "Variable choice qty"),
        ("VariableMinCost", "Variable min cost"),
        ("VariableMaxCost", "Variable max cost"),
        ("Active", "Active"),
        ("B2cEnabled", "B2C enabled"),
        ("B2bEnabled", "B2B enabled"),
        ("B2bPackageUnit", "B2B package unit"),
        ("Rrp", "RRP"),
        ("TotalCost", "Recipe cost"),
        ("PackagingCost", "Packaging cost"),
        ("YieldQuantity", "Yield quantity"),
        ("YieldUom", "Yield UOM"),
        ("ExpiryPeriodDays", "Expiry period (days)"),
        ("ActivationPeriodHours", "Activation period (hours)"),
        ("OrderLockPeriodDays", "Order lock period (days)"),
        ("ParStock", "Par stock"),
        ("ParStockUom", "Par stock UOM"),
        ("PosEnabled", "POS enabled"),
        ("LocationIds", "Locations"),
    ];

    public static FieldSnapshot Snapshot(Product product)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["ProductCode"] = product.ProductId ?? string.Empty,
            ["Name"] = product.Name ?? string.Empty,
            ["Category"] = product.Category ?? string.Empty,
            ["Group"] = product.Group ?? string.Empty,
            ["IsSubProduct"] = product.IsSubProduct ? "Yes" : "No",
            ["IsVariableProduct"] = product.IsVariableProduct ? "Yes" : "No",
            ["VariableMode"] = product.VariableMode ?? string.Empty,
            ["VariableChoiceQty"] = FormatDecimal(product.VariableChoiceQty),
            ["VariableMinCost"] = FormatDecimal(product.VariableMinCost),
            ["VariableMaxCost"] = FormatDecimal(product.VariableMaxCost),
            ["Active"] = product.Active ? "Yes" : "No",
            ["B2cEnabled"] = product.B2cEnabled ? "Yes" : "No",
            ["B2bEnabled"] = product.B2bEnabled ? "Yes" : "No",
            ["B2bPackageUnit"] = product.B2bPackageUnit ?? string.Empty,
            ["Rrp"] = FormatDecimal(product.Rrp),
            ["TotalCost"] = FormatDecimal(product.TotalCost),
            ["PackagingCost"] = FormatDecimal(product.PackagingCost),
            ["YieldQuantity"] = FormatDecimal(product.YieldQuantity),
            ["YieldUom"] = product.YieldUom ?? string.Empty,
            ["ExpiryPeriodDays"] = product.ExpiryPeriodDays.ToString(),
            ["ActivationPeriodHours"] = product.ActivationPeriodHours.ToString(),
            ["OrderLockPeriodDays"] = product.OrderLockPeriodDays.ToString(),
            ["ParStock"] = FormatDecimal(product.ParStock),
            ["ParStockUom"] = product.ParStockUom ?? string.Empty,
            ["PosEnabled"] = product.PosEnabled ? "Yes" : "No",
            ["LocationIds"] = product.LocationIdsJson ?? "[]",
        };
        return new FieldSnapshot(values);
    }

    public static List<ProductFieldChange> Diff(
        Product product,
        FieldSnapshot before,
        FieldSnapshot after,
        int? userId,
        string userEmail,
        string userName,
        DateTime changedAt)
    {
        var changes = new List<ProductFieldChange>();
        foreach (var (key, label) in TrackedFields)
        {
            before.Values.TryGetValue(key, out var oldValue);
            after.Values.TryGetValue(key, out var newValue);
            oldValue ??= string.Empty;
            newValue ??= string.Empty;
            if (string.Equals(oldValue, newValue, StringComparison.Ordinal))
                continue;

            changes.Add(new ProductFieldChange
            {
                ProductId = product.Id,
                ProductCode = product.ProductId,
                ProductName = product.Name,
                CompanyId = product.CompanyId,
                FieldName = key,
                FieldLabel = label,
                OldValue = oldValue,
                NewValue = newValue,
                ChangedByUserId = userId,
                ChangedByEmail = userEmail ?? string.Empty,
                ChangedByName = userName ?? string.Empty,
                ChangedAt = changedAt,
                Note = $"{label} changed",
            });
        }

        return changes;
    }

    public static ProductFieldChange Created(
        Product product,
        int? userId,
        string userEmail,
        string userName,
        DateTime changedAt) =>
        new()
        {
            ProductId = product.Id,
            ProductCode = product.ProductId,
            ProductName = product.Name,
            CompanyId = product.CompanyId,
            FieldName = "Created",
            FieldLabel = "Created",
            OldValue = string.Empty,
            NewValue = product.Name,
            ChangedByUserId = userId,
            ChangedByEmail = userEmail ?? string.Empty,
            ChangedByName = userName ?? string.Empty,
            ChangedAt = changedAt,
            Note = "Product created",
        };

    static string FormatDecimal(decimal value) =>
        DecimalRounding.ToDb(value).ToString("0.####");
}
