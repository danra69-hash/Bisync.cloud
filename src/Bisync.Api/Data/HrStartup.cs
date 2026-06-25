using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class HrStartup
{
    public static async Task InitializeAsync(BisyncDbContext db)
    {
        await HrSchemaPatcher.ApplyAsync(db);

        foreach (var sql in new[]
        {
            "ALTER TABLE Employees ADD COLUMN PosPin TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN PosPinMustChange INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN ReportsToId INTEGER NULL",
            "ALTER TABLE EmployeeLevels ADD COLUMN IsShift INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE EmployeeLevels ADD COLUMN ShiftType TEXT NULL",
            "ALTER TABLE CompanySettings ADD COLUMN OperatingCountryCode TEXT NOT NULL DEFAULT 'MY'",
            "ALTER TABLE PublicHolidays ADD COLUMN CountryCode TEXT NULL",
            "ALTER TABLE PublicHolidays ADD COLUMN CatalogKey TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN DivisionId INTEGER NULL",
            "ALTER TABLE Employees ADD COLUMN DepartmentId INTEGER NULL",
            "ALTER TABLE Employees ADD COLUMN Active INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE Employees ADD COLUMN CheckinMethod TEXT NOT NULL DEFAULT 'Biometrics'",
        })
        {
            try { await db.Database.ExecuteSqlRawAsync(sql); }
            catch { /* column already exists */ }
        }

        try
        {
            await db.Database.ExecuteSqlRawAsync("UPDATE PublicHolidays SET CountryCode = 'MY' WHERE CountryCode IS NULL");
        }
        catch { /* HR tables may not exist yet */ }

        try
        {
            await db.Database.ExecuteSqlRawAsync("UPDATE CompanySettings SET OperatingCountryCode = 'MY' WHERE OperatingCountryCode IS NULL OR OperatingCountryCode = ''");
        }
        catch { /* HR tables may not exist yet */ }

        foreach (var sql in new[]
        {
            """
            CREATE TABLE IF NOT EXISTS Divisions (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                Code TEXT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS Departments (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                DivisionId INTEGER NOT NULL,
                FOREIGN KEY (DivisionId) REFERENCES Divisions(Id) ON DELETE CASCADE
            )
            """,
            "CREATE UNIQUE INDEX IF NOT EXISTS IX_Divisions_Name ON Divisions(Name)",
            "CREATE UNIQUE INDEX IF NOT EXISTS IX_Departments_DivisionId_Name ON Departments(DivisionId, Name)",
        })
        {
            try { await db.Database.ExecuteSqlRawAsync(sql); }
            catch { /* table or index already exists */ }
        }

        var employeesWithLevels = await db.Employees
            .Include(e => e.EmployeeLevel)
            .Where(e => e.EmployeeLevelId != null)
            .ToListAsync();
        var changed = false;
        foreach (var employee in employeesWithLevels)
        {
            if (employee.EmployeeLevel is null) continue;
            var beforeShift = employee.IsShiftEmployee;
            var beforeType = employee.ShiftType;
            EmployeeShiftSync.ApplyFromLevel(employee);
            if (employee.IsShiftEmployee != beforeShift || employee.ShiftType != beforeType)
                changed = true;
        }
        if (changed)
            await db.SaveChangesAsync();

        await EmployeeSeeder.SeedAsync(db);
    }
}
