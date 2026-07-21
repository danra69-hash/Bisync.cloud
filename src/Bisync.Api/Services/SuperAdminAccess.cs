using System.Text.Json;

namespace Bisync.Api.Services;

public static class SuperAdminAccess
{
    public const string SuperAdminEmail = "dra@cubevalue.com";
    /// <summary>Default super-admin password for new installs. Matches platform demo password.</summary>
    public const string SuperAdminPassword = "Pass@123";

    static readonly string[] Modules = ["RMS", "POS", "HRM", "Accounting"];

    static readonly string[] RmsTasks =
    [
        "viewOrder", "createEditOrder", "approveOrder", "receiveOrder", "consolidateOrder",
        "cashPurchase", "orderTemplate", "productManagement", "subProductManagement", "offlineSales",
        "stockCard", "inventoryPost", "inventoryConfirmation", "inventoryAdjustment", "creditNote", "wastage",
        "transfer", "inventoryConfiguration", "createEdit", "componentConfig", "activateDeactivateVendorProducts",
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
