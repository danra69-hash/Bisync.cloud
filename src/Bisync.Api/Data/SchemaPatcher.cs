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
