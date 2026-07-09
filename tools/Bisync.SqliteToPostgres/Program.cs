using System.Data;
using System.Text;
using Microsoft.Data.Sqlite;
using Npgsql;
using NpgsqlTypes;

if (args.Length < 2)
{
    Console.Error.WriteLine("Usage: Bisync.SqliteToPostgres <sqlite-path> <postgres-connection-string>");
    return 1;
}

var sqlitePath = Path.GetFullPath(args[0]);
var postgresConnection = args[1];

if (!File.Exists(sqlitePath))
{
    Console.Error.WriteLine($"SQLite file not found: {sqlitePath}");
    return 1;
}

var sqliteBuilder = new SqliteConnectionStringBuilder { DataSource = sqlitePath };
await using var sqlite = new SqliteConnection(sqliteBuilder.ConnectionString);
await sqlite.OpenAsync();

await using var pg = new NpgsqlConnection(postgresConnection);
await pg.OpenAsync();
var tables = await GetSqliteTablesAsync(sqlite);
var pgColumns = await GetPostgresColumnsAsync(pg);
var pgColumnMeta = await GetPostgresColumnMetadataAsync(pg);
var insertOrder = await GetPostgresInsertOrderAsync(pg, tables);

Console.WriteLine($"Migrating {insertOrder.Count} tables from {sqlitePath}");

var tableNames = insertOrder.Select(t => t).ToList();
if (tableNames.Count > 0)
{
    var truncateSql = "TRUNCATE TABLE " + string.Join(", ", tableNames.Select(QuoteIdent)) + " RESTART IDENTITY CASCADE;";
    await using var truncate = new NpgsqlCommand(truncateSql, pg);
    await truncate.ExecuteNonQueryAsync();
    Console.WriteLine("Truncated destination tables.");
}

var totalRows = 0;
foreach (var table in insertOrder)
{
    if (!pgColumns.ContainsKey(table))
    {
        Console.WriteLine($"  skip {table} (not in PostgreSQL)");
        continue;
    }

    var sqliteColumns = await GetSqliteColumnsAsync(sqlite, table);
    var pgTableColumns = pgColumns[table];
    var pgTableMeta = pgColumnMeta[table];
    var insertColumns = BuildInsertColumns(sqliteColumns, pgTableColumns, pgTableMeta);
    if (insertColumns.Count == 0)
    {
        Console.WriteLine($"  skip {table} (no matching columns)");
        continue;
    }

    var sqliteSelectColumns = insertColumns.Where(c => sqliteColumns.Contains(c, StringComparer.OrdinalIgnoreCase)).ToList();
    var rows = await ReadSqliteRowsAsync(sqlite, table, sqliteSelectColumns);
    if (rows.Count == 0)
    {
        Console.WriteLine($"  {table}: 0 rows");
        continue;
    }

    var expandedRows = ExpandRows(insertColumns, sqliteSelectColumns, pgTableColumns, rows);
    if (table.Equals("Employees", StringComparison.OrdinalIgnoreCase))
        expandedRows = SortSelfReferentialRows(expandedRows, insertColumns, "Id", "ReportsToId");
    await InsertRowsAsync(pg, table, insertColumns, pgTableColumns, pgTableMeta, expandedRows);
    totalRows += rows.Count;
    Console.WriteLine($"  {table}: {rows.Count} rows");
}

await ResetSequencesAsync(pg, insertOrder);

Console.WriteLine($"Done. Migrated {totalRows} rows across {insertOrder.Count} tables.");
return 0;

static string QuoteIdent(string name) => $"\"{name.Replace("\"", "\"\"")}\"";

static async Task<List<string>> GetPostgresInsertOrderAsync(NpgsqlConnection pg, IReadOnlyList<string> tables)
{
    var tableSet = new HashSet<string>(tables, StringComparer.OrdinalIgnoreCase);
    var dependencies = tables.ToDictionary(
        t => t,
        _ => new HashSet<string>(StringComparer.OrdinalIgnoreCase),
        StringComparer.OrdinalIgnoreCase);

    await using var cmd = new NpgsqlCommand("""
        SELECT
            child.relname AS child_table,
            parent.relname AS parent_table
        FROM pg_constraint c
        JOIN pg_class child ON child.oid = c.conrelid
        JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
        JOIN pg_class parent ON parent.oid = c.confrelid
        WHERE c.contype = 'f'
          AND child_ns.nspname = 'public';
        """, pg);
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var child = reader.GetString(0);
        var parent = reader.GetString(1);
        if (!tableSet.Contains(child) || !tableSet.Contains(parent))
            continue;
        if (child.Equals(parent, StringComparison.OrdinalIgnoreCase))
            continue;
        dependencies[child].Add(parent);
    }

    var ordered = new List<string>();
    var pending = new HashSet<string>(tables, StringComparer.OrdinalIgnoreCase);
    while (pending.Count > 0)
    {
        var ready = pending
            .Where(table => dependencies[table].All(dep => !pending.Contains(dep)))
            .OrderBy(t => t, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (ready.Count == 0)
        {
            ordered.AddRange(pending.OrderBy(t => t, StringComparer.OrdinalIgnoreCase));
            break;
        }

        foreach (var table in ready)
        {
            ordered.Add(table);
            pending.Remove(table);
        }
    }

    return ordered;
}

static async Task<List<string>> GetSqliteTablesAsync(SqliteConnection sqlite)
{
    var tables = new List<string>();
    await using var cmd = sqlite.CreateCommand();
    cmd.CommandText = """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '__EF%'
        ORDER BY name;
        """;
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
        tables.Add(reader.GetString(0));
    return tables;
}

static async Task<List<string>> GetSqliteColumnsAsync(SqliteConnection sqlite, string table)
{
    var columns = new List<string>();
    await using var cmd = sqlite.CreateCommand();
    cmd.CommandText = $"PRAGMA table_info({QuoteIdent(table)});";
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
        columns.Add(reader.GetString(1));
    return columns;
}

static async Task<Dictionary<string, Dictionary<string, string>>> GetPostgresColumnsAsync(NpgsqlConnection pg)
{
    var result = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
    await using var cmd = new NpgsqlCommand("""
        SELECT table_name, column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
        """, pg);
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var table = reader.GetString(0);
        var column = reader.GetString(1);
        var dataType = reader.GetString(2);
        var udtName = reader.GetString(3);
        if (!result.TryGetValue(table, out var cols))
        {
            cols = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            result[table] = cols;
        }
        cols[column] = dataType == "USER-DEFINED" ? udtName : dataType;
    }
    return result;
}

static async Task<Dictionary<string, Dictionary<string, PgColumnMeta>>> GetPostgresColumnMetadataAsync(NpgsqlConnection pg)
{
    var result = new Dictionary<string, Dictionary<string, PgColumnMeta>>(StringComparer.OrdinalIgnoreCase);
    await using var cmd = new NpgsqlCommand("""
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position;
        """, pg);
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var table = reader.GetString(0);
        var column = reader.GetString(1);
        var dataType = reader.GetString(2);
        var udtName = reader.GetString(3);
        var isNullable = reader.GetString(4).Equals("YES", StringComparison.OrdinalIgnoreCase);
        var hasDefault = !reader.IsDBNull(5);
        if (!result.TryGetValue(table, out var cols))
        {
            cols = new Dictionary<string, PgColumnMeta>(StringComparer.OrdinalIgnoreCase);
            result[table] = cols;
        }
        cols[column] = new PgColumnMeta(
            dataType == "USER-DEFINED" ? udtName : dataType,
            isNullable,
            hasDefault);
    }
    return result;
}

static List<string> BuildInsertColumns(
    IReadOnlyList<string> sqliteColumns,
    IReadOnlyDictionary<string, string> pgTableColumns,
    IReadOnlyDictionary<string, PgColumnMeta> pgTableMeta)
{
    var sqliteSet = new HashSet<string>(sqliteColumns, StringComparer.OrdinalIgnoreCase);
    var columns = sqliteColumns.Where(pgTableColumns.ContainsKey).ToList();
    foreach (var (column, meta) in pgTableMeta)
    {
        if (!pgTableColumns.ContainsKey(column))
            continue;
        if (sqliteSet.Contains(column))
            continue;
        if (meta.IsNullable || meta.HasDefault)
            continue;
        columns.Add(column);
    }
    return columns;
}

static List<object?[]> ExpandRows(
    IReadOnlyList<string> insertColumns,
    IReadOnlyList<string> sqliteSelectColumns,
    IReadOnlyDictionary<string, string> pgTypes,
    IReadOnlyList<object?[]> rows)
{
    var sqliteIndex = sqliteSelectColumns
        .Select((column, index) => (column, index))
        .ToDictionary(x => x.column, x => x.index, StringComparer.OrdinalIgnoreCase);

    var expanded = new List<object?[]>(rows.Count);
    foreach (var row in rows)
    {
        var values = new object?[insertColumns.Count];
        for (var i = 0; i < insertColumns.Count; i++)
        {
            var column = insertColumns[i];
            if (sqliteIndex.TryGetValue(column, out var sourceIndex))
            {
                var value = row[sourceIndex];
                if (value is null or DBNull)
                    values[i] = DefaultValueForColumn(column, pgTypes[column]);
                else
                    values[i] = value;
            }
            else
            {
                values[i] = DefaultValueForColumn(column, pgTypes[column]);
            }
        }
        expanded.Add(values);
    }
    return expanded;
}

static object? DefaultValueForColumn(string column, string pgDataType)
{
    if (column.EndsWith("Json", StringComparison.OrdinalIgnoreCase))
        return column.Contains("Detail", StringComparison.OrdinalIgnoreCase) ? "{}" : "[]";

    return column switch
    {
        "CreatedAt" or "UpdatedAt" => DateTime.UtcNow,
        "ProductPolicyTag" => "non-halal",
        "B2bPackageUnit" => "pcs",
        "EffectiveDate" => string.Empty,
        _ when pgDataType == "boolean" => column.Contains("Active", StringComparison.OrdinalIgnoreCase),
        _ when pgDataType is "timestamp with time zone" or "timestamp without time zone" => DateTime.UtcNow,
        _ when pgDataType is "time without time zone" or "time with time zone" => TimeSpan.Zero,
        _ when pgDataType == "date" => DateOnly.FromDateTime(DateTime.UtcNow),
        _ when pgDataType is "integer" or "bigint" or "smallint" =>
            column.EndsWith("Id", StringComparison.OrdinalIgnoreCase) &&
            !column.Equals("Id", StringComparison.OrdinalIgnoreCase)
                ? null
                : 0,
        _ when pgDataType is "numeric" or "double precision" or "real" => 0m,
        _ => string.Empty,
    };
}

static List<object?[]> SortSelfReferentialRows(
    IReadOnlyList<object?[]> rows,
    IReadOnlyList<string> columns,
    string idColumn,
    string parentColumn)
{
    var idIndex = columns.ToList().FindIndex(c => c.Equals(idColumn, StringComparison.OrdinalIgnoreCase));
    var parentIndex = columns.ToList().FindIndex(c => c.Equals(parentColumn, StringComparison.OrdinalIgnoreCase));
    if (idIndex < 0 || parentIndex < 0)
        return rows.ToList();

    static int? ToNullableInt(object? value) => value is null or DBNull ? null : Convert.ToInt32(value);

    var sorted = new List<object?[]>(rows.Count);
    var insertedIds = new HashSet<int>();
    var pending = new Queue<object?[]>(rows);
    var guard = 0;
    while (pending.Count > 0 && guard++ <= rows.Count * rows.Count)
    {
        var row = pending.Dequeue();
        var parentId = ToNullableInt(row[parentIndex]);
        var id = ToNullableInt(row[idIndex]);
        if (id is null)
        {
            sorted.Add(row);
            continue;
        }

        if (parentId is null || parentId == id || insertedIds.Contains(parentId.Value))
        {
            sorted.Add(row);
            insertedIds.Add(id.Value);
        }
        else
        {
            pending.Enqueue(row);
        }
    }

    while (pending.Count > 0)
        sorted.Add(pending.Dequeue());

    return sorted;
}

static async Task<List<object?[]>> ReadSqliteRowsAsync(SqliteConnection sqlite, string table, List<string> columns)
{
    var rows = new List<object?[]>();
    var select = $"SELECT {string.Join(", ", columns.Select(QuoteIdent))} FROM {QuoteIdent(table)};";
    await using var cmd = sqlite.CreateCommand();
    cmd.CommandText = select;
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        var values = new object?[columns.Count];
        for (var i = 0; i < columns.Count; i++)
            values[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        rows.Add(values);
    }
    return rows;
}

static async Task InsertRowsAsync(
    NpgsqlConnection pg,
    string table,
    List<string> columns,
    Dictionary<string, string> pgTypes,
    Dictionary<string, PgColumnMeta> pgMeta,
    List<object?[]> rows)
{
    var columnList = string.Join(", ", columns.Select(QuoteIdent));
    var paramList = string.Join(", ", columns.Select((_, i) => $"@p{i}"));
    var insertSql = $"INSERT INTO {QuoteIdent(table)} ({columnList}) VALUES ({paramList});";

    await using var tx = await pg.BeginTransactionAsync();
    foreach (var row in rows)
    {
        await using var cmd = new NpgsqlCommand(insertSql, pg, tx);
        for (var i = 0; i < columns.Count; i++)
        {
            var column = columns[i];
            var value = ConvertValue(row[i], column, pgTypes[column], pgMeta[column].IsNullable);
            var parameter = new NpgsqlParameter($"p{i}", MapNpgsqlDbType(pgTypes[columns[i]]))
            {
                Value = value ?? DBNull.Value,
            };
            cmd.Parameters.Add(parameter);
        }
        await cmd.ExecuteNonQueryAsync();
    }
    await tx.CommitAsync();
}

static NpgsqlDbType MapNpgsqlDbType(string pgDataType) => pgDataType switch
{
    "boolean" => NpgsqlDbType.Boolean,
    "integer" => NpgsqlDbType.Integer,
    "bigint" => NpgsqlDbType.Bigint,
    "smallint" => NpgsqlDbType.Smallint,
    "numeric" => NpgsqlDbType.Numeric,
    "double precision" => NpgsqlDbType.Double,
    "real" => NpgsqlDbType.Real,
    "text" => NpgsqlDbType.Text,
    "character varying" => NpgsqlDbType.Varchar,
    "date" => NpgsqlDbType.Date,
    "time without time zone" => NpgsqlDbType.Time,
    "timestamp with time zone" => NpgsqlDbType.TimestampTz,
    "timestamp without time zone" => NpgsqlDbType.Timestamp,
    "json" => NpgsqlDbType.Json,
    "jsonb" => NpgsqlDbType.Jsonb,
    _ => NpgsqlDbType.Text,
};

static object? ConvertValue(object? value, string column, string pgDataType, bool isNullable)
{
    if (value is null or DBNull)
        return null;

    if (pgDataType is "integer" or "bigint" or "smallint")
    {
        if (value is string s && string.IsNullOrWhiteSpace(s))
            return null;

        var numeric = value switch
        {
            long l => l,
            int i => i,
            string numericText when long.TryParse(numericText, out var n) => n,
            _ => (long?)null,
        };
        if (numeric is 0 && isNullable)
            return null;
        if (numeric is null)
            return null;
        return numeric;
    }

    if (pgDataType is "time without time zone" or "time with time zone")
    {
        if (value is TimeSpan timeSpan)
            return timeSpan;
        if (value is string timeText)
        {
            if (string.IsNullOrWhiteSpace(timeText))
                return isNullable ? null : TimeSpan.Zero;
            if (TimeSpan.TryParse(timeText, out var parsedTime))
                return parsedTime;
            if (TimeOnly.TryParse(timeText, out var timeOnly))
                return timeOnly.ToTimeSpan();
        }
    }

    if (pgDataType is "boolean" or "bool")
    {
        return value switch
        {
            bool b => b,
            long l => l != 0,
            int i => i != 0,
            string s when long.TryParse(s, out var n) => n != 0,
            _ => Convert.ToBoolean(value),
        };
    }

    if (pgDataType is "timestamp with time zone" or "timestamp without time zone")
    {
        if (value is DateTime dt)
            return dt.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(dt, DateTimeKind.Utc) : dt.ToUniversalTime();
        if (value is string dateTimeText && DateTime.TryParse(dateTimeText, out var parsed))
            return DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
    }

    if (pgDataType == "date")
    {
        if (value is DateOnly dateOnlyValue)
            return dateOnlyValue;
        if (value is string dateText && DateOnly.TryParse(dateText, out var dateOnly))
            return dateOnly;
    }

    if (pgDataType is "time without time zone" or "time with time zone")
    {
        if (value is TimeSpan timeSpan)
            return timeSpan;
        if (value is string timeText && TimeSpan.TryParse(timeText, out var parsedTime))
            return parsedTime;
        if (value is string timeOnlyText && TimeOnly.TryParse(timeOnlyText, out var timeOnly))
            return timeOnly.ToTimeSpan();
    }

    if (pgDataType is "json" or "jsonb")
        return value is string json ? json : value?.ToString();

    if (pgDataType is "double precision" or "real" or "numeric")
    {
        if (value is double or float or decimal)
            return Convert.ToDecimal(value);
        if (value is string numText && decimal.TryParse(numText, out var dec))
            return dec;
    }

    return value;
}

static async Task ResetSequencesAsync(NpgsqlConnection pg, IReadOnlyList<string> tables)
{
    foreach (var table in tables)
    {
        var quotedTable = QuoteIdent(table);
        await using var cmd = new NpgsqlCommand(
            $"""
            SELECT setval(
                pg_get_serial_sequence('{table.Replace("'", "''")}', 'Id'),
                COALESCE((SELECT MAX("Id") FROM {quotedTable}), 1),
                true
            )
            WHERE pg_get_serial_sequence('{table.Replace("'", "''")}', 'Id') IS NOT NULL;
            """,
            pg);
        try { await cmd.ExecuteNonQueryAsync(); }
        catch { /* table may use non-Id PK */ }
    }
}

file sealed class PgColumnMeta(string dataType, bool isNullable, bool hasDefault)
{
    public string DataType { get; } = dataType;
    public bool IsNullable { get; } = isNullable;
    public bool HasDefault { get; } = hasDefault;
}
