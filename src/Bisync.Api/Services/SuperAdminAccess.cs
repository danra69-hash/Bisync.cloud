using System.Text.Json;

namespace Bisync.Api.Services;

public static class SuperAdminAccess
{
    public const string SuperAdminEmail = "dra@cubevalue.com";

    /// <summary>
    /// Historical login aliases for the same platform-owner person.
    /// Startup merge folds these AppUser/Employee rows into <see cref="SuperAdminEmail"/>.
    /// </summary>
    public static readonly string[] AliasEmails = ["dra@test.com"];

    public static string NormalizeLoginEmail(string? email)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Length == 0) return normalized;
        foreach (var alias in AliasEmails)
        {
            if (string.Equals(normalized, alias, StringComparison.OrdinalIgnoreCase))
                return SuperAdminEmail.ToLowerInvariant();
        }
        return normalized;
    }

    public static bool IsPlatformOwnerEmail(string? email)
    {
        var normalized = (email ?? string.Empty).Trim().ToLowerInvariant();
        if (normalized.Length == 0) return false;
        if (string.Equals(normalized, SuperAdminEmail, StringComparison.OrdinalIgnoreCase))
            return true;
        return AliasEmails.Any(a => string.Equals(normalized, a, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Bootstrap password for the seeded DRA Super Admin / Dev Console root.
    /// Prefer <c>BISYNC_SUPER_ADMIN_PASSWORD</c> in production; falls back to the
    /// local/demo default used by Automated QA and fresh installs.
    /// </summary>
    public static string SuperAdminPassword
    {
        get
        {
            var fromEnv = Environment.GetEnvironmentVariable("BISYNC_SUPER_ADMIN_PASSWORD");
            if (!string.IsNullOrWhiteSpace(fromEnv))
                return fromEnv.Trim();
            return DefaultBootstrapPassword;
        }
    }

    /// <summary>Local/dev bootstrap only — override via BISYNC_SUPER_ADMIN_PASSWORD in production.</summary>
    internal const string DefaultBootstrapPassword = "Pass@123";

    static readonly string[] Modules = ["RMS", "POS", "HRM", "Accounting"];

    static readonly string[] RmsTasks =
    [
        "viewOrder", "createEditOrder", "approveOrder", "receiveOrder", "consolidateOrder",
        "cashPurchase", "orderTemplate", "productManagement", "subProductManagement", "offlineSales",
        "stockCard", "inventoryPost", "inventoryConfirmation", "inventoryAdjustment", "creditNote", "wastage",
        "transfer", "createEdit", "componentConfig", "activateDeactivateVendorProducts",
        "createEditComponentGroup", "createEditStorageAssignment", "accountMapping",
        "viewVendorList", "viewVendorProducts", "comparePrice", "activateDeactivateVendor",
        "viewProductSubProduct", "manageProductSubProduct", "externalPosMapping",
        "manageCustomers", "customerGroup", "customerManagement", "manageSalesOrder", "approveSalesOrder",
        "manageInvoice", "promotionScheduler", "viewReports",
        "itemizedSalesSummary", "inventorySummary", "detailedPurchaseSummary", "productionReport", "wastageReport", "cogsAudit",
        // hidePrices intentionally omitted — restriction policy, not a super-admin grant
    ];

    public static string BuildJson()
    {
        var tasks = RmsTasks.ToDictionary(id => id, _ => true);
        var payload = new
        {
            modules = Modules,
            rms = new { enabled = true, tasks },
            superAdmin = true,
        };
        return JsonSerializer.Serialize(payload);
    }
}
