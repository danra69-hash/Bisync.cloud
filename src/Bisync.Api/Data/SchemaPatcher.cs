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
    }

    static async Task TryAddColumnAsync(BisyncDbContext db, string table, string column, string definition)
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync($"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {definition};");
        }
        catch
        {
            // Column already exists
        }
    }
}
