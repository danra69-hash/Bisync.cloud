using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class SchemaPatcher
{
    public static async Task ApplyAsync(BisyncDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Companies" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_Companies" PRIMARY KEY AUTOINCREMENT,
                "Name" TEXT NOT NULL,
                "Brn" TEXT NOT NULL,
                "GstTin" TEXT NOT NULL,
                "CountryCode" TEXT NOT NULL,
                "AddressLine1" TEXT NOT NULL,
                "AddressLine2" TEXT NOT NULL,
                "City" TEXT NOT NULL,
                "StateProvince" TEXT NOT NULL,
                "Postcode" TEXT NOT NULL,
                "Phone" TEXT NOT NULL,
                "Fax" TEXT NOT NULL,
                "Email" TEXT NOT NULL,
                "Active" INTEGER NOT NULL
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "AppUsers" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_AppUsers" PRIMARY KEY AUTOINCREMENT,
                "FullName" TEXT NOT NULL,
                "Email" TEXT NOT NULL,
                "Role" TEXT NOT NULL,
                "Phone" TEXT NOT NULL,
                "Active" INTEGER NOT NULL,
                "AccessJson" TEXT NOT NULL DEFAULT '',
                "CompanyId" INTEGER NULL,
                "LocationIdsJson" TEXT NOT NULL DEFAULT '[]'
            );
            """);

        await TryAddColumnAsync(db, "Locations", "CompanyId", "INTEGER");
        await TryAddColumnAsync(db, "Locations", "AddressLine1", "TEXT NOT NULL DEFAULT ''");
        await TryAddColumnAsync(db, "Locations", "AddressLine2", "TEXT NOT NULL DEFAULT ''");
        await TryAddColumnAsync(db, "Locations", "City", "TEXT NOT NULL DEFAULT ''");
        await TryAddColumnAsync(db, "Locations", "StateProvince", "TEXT NOT NULL DEFAULT ''");
        await TryAddColumnAsync(db, "Locations", "Postcode", "TEXT NOT NULL DEFAULT ''");
        await TryAddColumnAsync(db, "Locations", "PrincipalContactUserId", "INTEGER");
        await TryAddColumnAsync(db, "AppUsers", "AccessJson", "TEXT NOT NULL DEFAULT ''");
        await TryAddColumnAsync(db, "AppUsers", "CompanyId", "INTEGER");
        await TryAddColumnAsync(db, "AppUsers", "LocationIdsJson", "TEXT NOT NULL DEFAULT '[]'");
        await TryAddColumnAsync(db, "AppUsers", "EmployeeId", "INTEGER");
        await TryAddColumnAsync(db, "AppUsers", "PasswordHash", "TEXT");
        await EnsureColumnAsync(db, "Ingredients", "ComponentId", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "Ingredients", "StorageNote", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "Ingredients", "DetailConfigJson", "TEXT NOT NULL DEFAULT '{}'");
        await EnsureColumnAsync(db, "Vendors", "ContactPosition", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "Vendors", "ContactsJson", "TEXT NOT NULL DEFAULT '[]'");
        await BackfillIngredientComponentIdsAsync(db);
        await TryCreateUniqueIndexAsync(db, "IX_Ingredients_ComponentId", "Ingredients", "ComponentId");
        await TryCreateUniqueIndexAsync(db, "IX_Ingredients_Name", "Ingredients", "Name");
        await VendorCatalogSeeder.EnsureCatalogVendorsAsync(db);
        await IngredientCatalogSeeder.EnsureCatalogIngredientsAsync(db);

        await EnsureColumnAsync(db, "PurchaseOrders", "DocumentType", "TEXT NOT NULL DEFAULT 'PO'");
        await EnsureColumnAsync(db, "PurchaseOrders", "CompanyId", "INTEGER");
        await EnsureColumnAsync(db, "PurchaseOrders", "LocationIdsJson", "TEXT NOT NULL DEFAULT '[]'");
        await EnsureColumnAsync(db, "PurchaseOrders", "InitiatedBy", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "PurchaseOrders", "ApprovedBy", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "PurchaseOrders", "ApprovedAt", "TEXT");
        await EnsureColumnAsync(db, "PurchaseOrders", "ReceivedAt", "TEXT");
        await EnsureColumnAsync(db, "PurchaseOrders", "ReconciledAt", "TEXT");
        await EnsureColumnAsync(db, "PurchaseOrders", "VendorShareToken", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "PurchaseOrders", "VendorAcceptedAt", "TEXT");
        await EnsureColumnAsync(db, "PurchaseOrders", "VendorAcceptedBy", "TEXT NOT NULL DEFAULT ''");

        await db.Database.ExecuteSqlRawAsync("""
            UPDATE PurchaseOrders
            SET DocumentType = 'PR'
            WHERE Status = 'Pending Approval' AND DocumentType = 'PO';
            """);

        await EnsureColumnAsync(db, "PurchaseOrderItems", "ComponentId", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "PurchaseOrderItems", "ComponentName", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "PurchaseOrderItems", "ComponentUom", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "PurchaseOrderItems", "ReceivedQuantity", "REAL");
        await EnsureColumnAsync(db, "PurchaseOrderItems", "ReceivedUnitPrice", "REAL");
        await EnsureColumnAsync(db, "PurchaseOrderItems", "ReconciledQuantity", "REAL");
        await EnsureColumnAsync(db, "PurchaseOrderItems", "ReconciledUnitPrice", "REAL");
        await EnsureColumnAsync(db, "PurchaseOrderItems", "TaxAmount", "REAL NOT NULL DEFAULT 0");

        await EnsureColumnAsync(db, "PurchaseOrderItems", "VendorProductId", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "PurchaseOrderItems", "IssuedUnitPrice", "REAL NOT NULL DEFAULT 0");

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "InventoryPurchases" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_InventoryPurchases" PRIMARY KEY AUTOINCREMENT,
                "ComponentId" TEXT NOT NULL,
                "ComponentName" TEXT NOT NULL,
                "Quantity" REAL NOT NULL,
                "Uom" TEXT NOT NULL,
                "UnitPrice" REAL NOT NULL,
                "DateOrdered" TEXT NOT NULL,
                "DateCreatedInStock" TEXT NOT NULL,
                "PurchaseOrderId" INTEGER NOT NULL,
                "PurchaseOrderItemId" INTEGER NOT NULL,
                "CompanyId" INTEGER,
                "LocationIdsJson" TEXT NOT NULL DEFAULT '[]'
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "VendorProductPrices" (
                "ExternalId" TEXT NOT NULL CONSTRAINT "PK_VendorProductPrices" PRIMARY KEY,
                "DeliveryPrice" REAL NOT NULL,
                "UpdatedAt" TEXT NOT NULL,
                "LastPurchaseOrderId" INTEGER
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "UserNotifications" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_UserNotifications" PRIMARY KEY AUTOINCREMENT,
                "UserId" INTEGER,
                "RecipientName" TEXT NOT NULL DEFAULT '',
                "PurchaseOrderId" INTEGER,
                "Type" TEXT NOT NULL DEFAULT '',
                "Title" TEXT NOT NULL DEFAULT '',
                "Body" TEXT NOT NULL DEFAULT '',
                "CreatedAt" TEXT NOT NULL,
                "ReadAt" TEXT
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "CashPurchases" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_CashPurchases" PRIMARY KEY AUTOINCREMENT,
                "DatePurchased" TEXT NOT NULL,
                "StoreName" TEXT NOT NULL DEFAULT '',
                "ComponentId" TEXT NOT NULL DEFAULT '',
                "ComponentName" TEXT NOT NULL DEFAULT '',
                "StoreProductName" TEXT NOT NULL DEFAULT '',
                "DeliveryUnit" TEXT NOT NULL DEFAULT '',
                "DeliveryPrice" REAL NOT NULL,
                "Quantity" REAL NOT NULL,
                "ComponentUom" TEXT NOT NULL DEFAULT '',
                "ReceiptNumber" TEXT NOT NULL DEFAULT '',
                "ReceiptFileName" TEXT NOT NULL DEFAULT '',
                "ReceiptFileBase64" TEXT NOT NULL DEFAULT '',
                "InventoryPurchaseId" INTEGER NOT NULL DEFAULT 0,
                "CompanyId" INTEGER,
                "LocationIdsJson" TEXT NOT NULL DEFAULT '[]',
                "CreatedAt" TEXT NOT NULL
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "OrderTemplates" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_OrderTemplates" PRIMARY KEY AUTOINCREMENT,
                "Name" TEXT NOT NULL DEFAULT '',
                "VendorExternalId" TEXT NOT NULL DEFAULT '',
                "VendorName" TEXT NOT NULL DEFAULT '',
                "ScheduleMode" TEXT NOT NULL DEFAULT '',
                "WeekdaysJson" TEXT NOT NULL DEFAULT '[]',
                "MonthDaysJson" TEXT NOT NULL DEFAULT '[]',
                "RepeatEnabled" INTEGER NOT NULL DEFAULT 0,
                "CompanyId" INTEGER,
                "LocationIdsJson" TEXT NOT NULL DEFAULT '[]',
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "OrderTemplateItems" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_OrderTemplateItems" PRIMARY KEY AUTOINCREMENT,
                "OrderTemplateId" INTEGER NOT NULL,
                "ComponentId" TEXT NOT NULL DEFAULT '',
                "ComponentName" TEXT NOT NULL DEFAULT '',
                "VendorProductId" TEXT NOT NULL DEFAULT '',
                "VendorExternalId" TEXT NOT NULL DEFAULT '',
                "VendorName" TEXT NOT NULL DEFAULT '',
                "ProductName" TEXT NOT NULL DEFAULT '',
                "Quantity" REAL NOT NULL,
                "ComponentUom" TEXT NOT NULL DEFAULT '',
                "DeliveryUnit" TEXT NOT NULL DEFAULT '',
                "SortOrder" INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT "FK_OrderTemplateItems_OrderTemplates_OrderTemplateId"
                    FOREIGN KEY ("OrderTemplateId") REFERENCES "OrderTemplates" ("Id") ON DELETE CASCADE
            );
            """);

        await EnsureColumnAsync(db, "OrderTemplateItems", "DeliveryUnit", "TEXT NOT NULL DEFAULT ''");

        await EnsureColumnAsync(db, "Products", "Rrp", "REAL NOT NULL DEFAULT 0");
        await EnsureColumnAsync(db, "Products", "PosEnabled", "INTEGER NOT NULL DEFAULT 0");
        await EnsureColumnAsync(db, "Products", "Active", "INTEGER NOT NULL DEFAULT 1");
        await EnsureColumnAsync(db, "Products", "YieldQuantity", "REAL NOT NULL DEFAULT 0");
        await EnsureColumnAsync(db, "Products", "YieldUom", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "Products", "PackagingCost", "REAL NOT NULL DEFAULT 0");
        await EnsureColumnAsync(db, "Products", "PreviousTotalCost", "REAL NULL");
        await EnsureColumnAsync(db, "Products", "PreviousPackagingCost", "REAL NULL");
        await EnsureColumnAsync(db, "Products", "PreviousRrp", "REAL NULL");
        await EnsureColumnAsync(db, "Products", "B2bPackageUnit", "TEXT NOT NULL DEFAULT 'pcs'");
        await EnsureColumnAsync(db, "Products", "ExpiryPeriodDays", "INTEGER NOT NULL DEFAULT 0");

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ProductB2bLocationStocks" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductB2bLocationStocks" PRIMARY KEY AUTOINCREMENT,
                "ProductId" INTEGER NOT NULL,
                "LocationExternalId" TEXT NOT NULL DEFAULT '',
                "InStock" REAL NOT NULL DEFAULT 0,
                "SalesPerDay" REAL NOT NULL DEFAULT 0,
                "ToProduceQty" REAL NOT NULL DEFAULT 0,
                "UpdatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_ProductB2bLocationStocks_Products_ProductId"
                    FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
            );
            """);
        await EnsureColumnAsync(db, "ProductB2bLocationStocks", "ProducedQty", "REAL NOT NULL DEFAULT 0");
        await EnsureColumnAsync(db, "ProductB2bLocationStocks", "ExpiryDate", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "ProductProductionLogs", "ExpiryDate", "TEXT NOT NULL DEFAULT ''");
        await EnsureColumnAsync(db, "ProductProductionLogs", "BatchNumber", "TEXT NOT NULL DEFAULT ''");

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ProductProductionLogs" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductProductionLogs" PRIMARY KEY AUTOINCREMENT,
                "ProductId" INTEGER NOT NULL,
                "EntryType" TEXT NOT NULL DEFAULT '',
                "Quantity" REAL NOT NULL DEFAULT 0,
                "ProductionDate" TEXT NOT NULL DEFAULT '',
                "LocationIdsJson" TEXT NOT NULL DEFAULT '[]',
                "CompanyId" INTEGER,
                "CreatedAt" TEXT NOT NULL,
                CONSTRAINT "FK_ProductProductionLogs_Products_ProductId"
                    FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
            );
            """);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ProductB2bLocationStocks_ProductId_LocationExternalId"
            ON "ProductB2bLocationStocks" ("ProductId", "LocationExternalId");
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "InventoryMovements" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_InventoryMovements" PRIMARY KEY AUTOINCREMENT,
                "ComponentId" TEXT NOT NULL DEFAULT '',
                "ComponentName" TEXT NOT NULL DEFAULT '',
                "LocationExternalId" TEXT NOT NULL DEFAULT '',
                "QtyDelta" REAL NOT NULL DEFAULT 0,
                "Uom" TEXT NOT NULL DEFAULT '',
                "Reason" TEXT NOT NULL DEFAULT '',
                "ReferenceType" TEXT NOT NULL DEFAULT '',
                "ReferenceId" INTEGER NOT NULL DEFAULT 0,
                "CompanyId" INTEGER,
                "CreatedAt" TEXT NOT NULL
            );
            """);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_ComponentId_LocationExternalId"
            ON "InventoryMovements" ("ComponentId", "LocationExternalId");
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ProductPackagingItems" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductPackagingItems" PRIMARY KEY AUTOINCREMENT,
                "ProductId" INTEGER NOT NULL,
                "ComponentId" TEXT NOT NULL DEFAULT '',
                "ComponentName" TEXT NOT NULL DEFAULT '',
                "ComponentUom" TEXT NOT NULL DEFAULT '',
                "ComponentUomPrice" REAL NOT NULL DEFAULT 0,
                "Quantity" REAL NOT NULL,
                "Subtotal" REAL NOT NULL DEFAULT 0,
                "SortOrder" INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT "FK_ProductPackagingItems_Products_ProductId"
                    FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ProductAliases" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductAliases" PRIMARY KEY AUTOINCREMENT,
                "ProductId" INTEGER NOT NULL,
                "Name" TEXT NOT NULL DEFAULT '',
                "Rrp" REAL NOT NULL DEFAULT 0,
                "SortOrder" INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT "FK_ProductAliases_Products_ProductId"
                    FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Products" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_Products" PRIMARY KEY AUTOINCREMENT,
                "ProductId" TEXT NOT NULL DEFAULT '',
                "Name" TEXT NOT NULL DEFAULT '',
                "Category" TEXT NOT NULL DEFAULT '',
                "Group" TEXT NOT NULL DEFAULT '',
                "IsSubProduct" INTEGER NOT NULL DEFAULT 0,
                "B2cEnabled" INTEGER NOT NULL DEFAULT 0,
                "B2bEnabled" INTEGER NOT NULL DEFAULT 0,
                "TotalCost" REAL NOT NULL DEFAULT 0,
                "CompanyId" INTEGER,
                "LocationIdsJson" TEXT NOT NULL DEFAULT '[]',
                "CreatedAt" TEXT NOT NULL,
                "UpdatedAt" TEXT NOT NULL
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ProductComponentItems" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_ProductComponentItems" PRIMARY KEY AUTOINCREMENT,
                "ProductId" INTEGER NOT NULL,
                "ComponentId" TEXT NOT NULL DEFAULT '',
                "ComponentName" TEXT NOT NULL DEFAULT '',
                "ComponentUom" TEXT NOT NULL DEFAULT '',
                "ComponentUomPrice" REAL NOT NULL DEFAULT 0,
                "Quantity" REAL NOT NULL,
                "Subtotal" REAL NOT NULL DEFAULT 0,
                "SortOrder" INTEGER NOT NULL DEFAULT 0,
                CONSTRAINT "FK_ProductComponentItems_Products_ProductId"
                    FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
            );
            """);
    }

    static async Task BackfillIngredientComponentIdsAsync(BisyncDbContext db)
    {
        var needsId = await db.Ingredients
            .Where(i => i.ComponentId == null || i.ComponentId == "")
            .OrderBy(i => i.Id)
            .ToListAsync();

        foreach (var ingredient in needsId)
        {
            ingredient.ComponentId = await ComponentIdGenerator.GenerateAsync(db, ingredient.Name, ingredient.Id);
        }

        if (needsId.Count > 0)
            await db.SaveChangesAsync();
    }

    static async Task TryCreateUniqueIndexAsync(BisyncDbContext db, string indexName, string table, string column)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync(
                $"CREATE UNIQUE INDEX IF NOT EXISTS \"{indexName}\" ON \"{table}\" (\"{column}\");");
        }
        catch
        {
            // Index may already exist with different definition
        }
    }

    static async Task EnsureColumnAsync(BisyncDbContext db, string table, string column, string definition)
    {
        if (await ColumnExistsAsync(db, table, column))
            return;

        await db.Database.ExecuteSqlRawAsync(
            $"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {EscapeBracesForRawSql(definition)};");
    }

    static async Task<bool> ColumnExistsAsync(BisyncDbContext db, string table, string column)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;
        if (shouldClose)
            await connection.OpenAsync();

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info(\"{table}\");";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var name = reader.GetString(1);
                if (string.Equals(name, column, StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }
    }

    static async Task TryAddColumnAsync(BisyncDbContext db, string table, string column, string definition)
    {
        if (await ColumnExistsAsync(db, table, column))
            return;

        try
        {
            await db.Database.ExecuteSqlRawAsync(
                $"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {EscapeBracesForRawSql(definition)};");
        }
        catch
        {
            // Column may have been added concurrently
        }
    }

    static string EscapeBracesForRawSql(string sql) =>
        sql.Replace("{", "{{").Replace("}", "}}");
}
