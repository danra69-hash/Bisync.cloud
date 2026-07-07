using System.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>PostgreSQL schema helpers shared by startup patchers.</summary>
public static class DatabaseSchemaHelper
{
    public static async Task<bool> ColumnExistsAsync(DbContext db, string table, string column)
    {
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
            await connection.OpenAsync();

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND lower(table_name) = lower(@table)
                      AND lower(column_name) = lower(@column)
                )
                """;

            var tableParam = command.CreateParameter();
            tableParam.ParameterName = "@table";
            tableParam.Value = table;
            command.Parameters.Add(tableParam);

            var columnParam = command.CreateParameter();
            columnParam.ParameterName = "@column";
            columnParam.Value = column;
            command.Parameters.Add(columnParam);

            var result = await command.ExecuteScalarAsync();
            return result is bool exists && exists;
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }
    }

    public static async Task EnsureColumnAsync(DbContext db, string table, string column, string definition)
    {
        if (await ColumnExistsAsync(db, table, column))
            return;

        await db.Database.ExecuteSqlRawAsync(
            $"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {EscapeBracesForRawSql(definition)};");
    }

    public static async Task TryAddColumnAsync(DbContext db, string table, string column, string definition)
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
            // Column may have been added concurrently.
        }
    }

    public static string EscapeBracesForRawSql(string sql) =>
        sql.Replace("{", "{{").Replace("}", "}}");

    /// <summary>
    /// Fixes PostgreSQL identity sequences after SQLite imports or manual ID inserts.
    /// No-op when the table has no serial/identity sequence.
    /// </summary>
    public static async Task TryResyncIdentitySequenceAsync(DbContext db, string table, string column = "Id")
    {
        try
        {
            await db.Database.ExecuteSqlRawAsync($"""
                DO $$
                DECLARE seq_name text;
                BEGIN
                    seq_name := pg_get_serial_sequence('"{table}"', '{column}');
                    IF seq_name IS NOT NULL THEN
                        PERFORM setval(
                            seq_name,
                            GREATEST(COALESCE((SELECT MAX("{column}") FROM "{table}"), 0), 1),
                            (SELECT COUNT(*) > 0 FROM "{table}")
                        );
                    END IF;
                END $$;
                """);
        }
        catch
        {
            // Non-PostgreSQL providers or tables without identity columns.
        }
    }

    public static async Task ResyncCoreIdentitySequencesAsync(DbContext db)
    {
        string[] tables =
        [
            "PurchaseOrders",
            "PurchaseOrderItems",
            "Vendors",
            "Ingredients",
            "InventoryPurchases",
            "AppUsers",
            "Companies",
            "CashPurchases",
            "OrderTemplates",
            "OrderTemplateItems",
            "UserNotifications",
        ];

        foreach (var table in tables)
            await TryResyncIdentitySequenceAsync(db, table);
    }
}
