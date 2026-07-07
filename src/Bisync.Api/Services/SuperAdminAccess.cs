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
        "cashPurchase", "orderTemplate", "productManagement", "offlineSales", "batchStockAdjustment",
        "inventoryPost", "inventoryConfirmation", "inventoryAdjustment", "creditNote", "wastage",
        "transfer", "inventoryConfiguration", "createEdit", "activateDeactivateVendorProducts",
        "createEditComponentGroup", "createEditStorageAssignment", "accountMapping",
        "viewVendorList", "viewVendorProducts", "activateDeactivateVendor",
        "viewProductSubProduct", "manageProductSubProduct", "manageCustomers", "customerGroup",
        "manageSalesOrder", "manageInvoice", "promotionScheduler", "viewReports",
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
