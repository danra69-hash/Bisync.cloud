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
            "ALTER TABLE EmployeeLevels ADD COLUMN Active INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE CompanySettings ADD COLUMN OperatingCountryCode TEXT NOT NULL DEFAULT 'MY'",
            "ALTER TABLE CompanySettings ADD COLUMN ReplacementPublicHolidayEnabled INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE CompanySettings ADD COLUMN GazettedPhReplacementDayEnabled INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE CompanySettings ADD COLUMN GazettedPhNormalHoursRate REAL NOT NULL DEFAULT 1.5",
            "ALTER TABLE CompanySettings ADD COLUMN GazettedPhOvertimeHoursRate REAL NOT NULL DEFAULT 2.0",
            "ALTER TABLE CompanySettings ADD COLUMN NonGazettedPhReplacementDayEnabled INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE AttendanceRecords ADD COLUMN RphAccruedDays REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PublicHolidays ADD COLUMN CountryCode TEXT NULL",
            "ALTER TABLE PublicHolidays ADD COLUMN CatalogKey TEXT NULL",
            "ALTER TABLE PublicHolidays ADD COLUMN IsRecurringAnnually INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE PublicHolidays ADD COLUMN IsGazetted INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN DivisionId INTEGER NULL",
            "ALTER TABLE Employees ADD COLUMN DepartmentId INTEGER NULL",
            "ALTER TABLE Employees ADD COLUMN Active INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE Employees ADD COLUMN CheckinMethod TEXT NOT NULL DEFAULT 'Biometrics'",
            "ALTER TABLE Employees ADD COLUMN PayrollPin TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN PayrollPinMustChange INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE Employees ADD COLUMN BaseSalary REAL NULL",
            "ALTER TABLE Employees ADD COLUMN ServiceAllowance REAL NULL",
            "ALTER TABLE Employees ADD COLUMN TransportAllowance REAL NULL",
            "ALTER TABLE Employees ADD COLUMN AccommodationAllowance REAL NULL",
            "ALTER TABLE Employees ADD COLUMN MobileAllowance REAL NULL",
            "ALTER TABLE Employees ADD COLUMN OtherAllowancesJson TEXT NOT NULL DEFAULT '[]'",
            "ALTER TABLE Employees ADD COLUMN WorkPermitByCompany INTEGER NULL",
            "ALTER TABLE Employees ADD COLUMN TransportProvided INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN TransportCarModel TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN TransportPlateNumber TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN AccommodationProvided INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN AccommodationAddress TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN AccommodationLeasingPeriod TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN MobileProvided INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN MobileAllowancePhone TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN MobileProvider TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN OvertimeAllowanceEnabled INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN AccommodationLeaseStart TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN AccommodationLeaseEnd TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN BonusEnabled INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN BonusMonthly INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN BonusAnnually INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN BonusAmount REAL NULL",
            "ALTER TABLE Employees ADD COLUMN BonusByBasicSalary INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN BonusByService INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN BankName TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN BankAccountNumber TEXT NULL",
            "ALTER TABLE Employees ADD COLUMN BankAccountHolderName TEXT NULL",
            "ALTER TABLE PayrollRuns ADD COLUMN TotalPayout REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN OvertimeHours REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN ServiceAllowance REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN AccommodationAllowance REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN TransportAllowance REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN MobileAllowance REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN EpfEmployeeAmount REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN EpfEmployerAmount REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN SocsoEmployeeAmount REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN SocsoEmployerAmount REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN IncomeTaxAmount REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayrollRunLines ADD COLUMN TotalPayout REAL NOT NULL DEFAULT 0",
            "ALTER TABLE PayStructures ADD COLUMN OvertimeRateMultiplier REAL NOT NULL DEFAULT 1.5",
            "ALTER TABLE PayStructures ADD COLUMN OvertimeCalculationMode TEXT NOT NULL DEFAULT 'Calculated'",
            "ALTER TABLE PayStructures ADD COLUMN OvertimeFixedHourlyRate REAL NULL",
            "ALTER TABLE PayStructures ADD COLUMN ForeignProvidentFundEmployerPct REAL NOT NULL DEFAULT 2",
            "ALTER TABLE PayStructures ADD COLUMN ForeignProvidentFundEmployeePct REAL NOT NULL DEFAULT 2",
            "ALTER TABLE PayStructures ADD COLUMN ForeignSocsoEmployerPct REAL NOT NULL DEFAULT 1.25",
            "ALTER TABLE IncomeTaxBrackets ADD COLUMN BaseMinTaxAmount REAL NOT NULL DEFAULT 0",
            "ALTER TABLE Employees ADD COLUMN MaritalStatus TEXT NULL",
            "ALTER TABLE IncomeTaxReliefs ADD COLUMN IsMaximum INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE IncomeTaxReliefs ADD COLUMN ApplyCondition TEXT NULL",
        })
        {
            try { await db.Database.ExecuteSqlRawAsync(sql); }
            catch { /* column already exists */ }
        }

        try
        {
            await db.Database.ExecuteSqlRawAsync("UPDATE PublicHolidays SET CountryCode = 'MY' WHERE CountryCode IS NULL");
            await db.Database.ExecuteSqlRawAsync(
                "UPDATE PublicHolidays SET IsGazetted = 1 WHERE CatalogKey IS NOT NULL AND CatalogKey NOT LIKE 'CUSTOM|%'");
        }
        catch { /* HR tables may not exist yet */ }

        try
        {
            await db.Database.ExecuteSqlRawAsync("UPDATE CompanySettings SET OperatingCountryCode = 'MY' WHERE OperatingCountryCode IS NULL OR OperatingCountryCode = ''");
            await db.Database.ExecuteSqlRawAsync("""
                UPDATE CompanySettings SET
                    GazettedPhReplacementDayEnabled = ReplacementPublicHolidayEnabled
                WHERE GazettedPhReplacementDayEnabled = 0 AND ReplacementPublicHolidayEnabled = 1
                """);
            await db.Database.ExecuteSqlRawAsync("""
                UPDATE CompanySettings SET
                    GazettedPhNormalHoursRate = PublicHolidayPayMultiplier
                WHERE GazettedPhNormalHoursRate = 1.5 AND PublicHolidayPayMultiplier != 1.5
                """);
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
            """
            CREATE TABLE IF NOT EXISTS PayStructures (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                CompanyId INTEGER NOT NULL UNIQUE,
                CountryCode TEXT NOT NULL,
                PayType TEXT NOT NULL,
                PayCycle TEXT NOT NULL,
                ProvidentFundEmployerPct REAL NOT NULL DEFAULT 0,
                ProvidentFundEmployeePct REAL NOT NULL DEFAULT 0,
                Active INTEGER NOT NULL DEFAULT 1,
                TransportationAllowanceAmount REAL NULL,
                TransportationProvided INTEGER NOT NULL DEFAULT 0,
                TransportationContactMobile TEXT NULL,
                MobileAllowanceAmount REAL NULL,
                MobileProvided INTEGER NOT NULL DEFAULT 0,
                CompanyVehicleAsRequired INTEGER NOT NULL DEFAULT 0,
                AccommodationAmount REAL NULL,
                AccommodationFrequency TEXT NULL,
                AccommodationProvided INTEGER NOT NULL DEFAULT 0,
                AccommodationAddress TEXT NULL,
                AccommodationLeaseDueDate TEXT NULL,
                FOREIGN KEY (CompanyId) REFERENCES Companies(Id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS MandatoryContributions (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                PayStructureId INTEGER NOT NULL,
                Name TEXT NOT NULL,
                EmployerPct REAL NOT NULL DEFAULT 0,
                EmployeePct REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (PayStructureId) REFERENCES PayStructures(Id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS ProvidentFundBrackets (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                PayStructureId INTEGER NOT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                MinAge INTEGER NULL,
                MaxAge INTEGER NULL,
                MinMonthlySalary REAL NULL,
                MaxMonthlySalary REAL NULL,
                EmployerPct REAL NOT NULL DEFAULT 0,
                EmployeePct REAL NOT NULL DEFAULT 0,
                NoContribution INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (PayStructureId) REFERENCES PayStructures(Id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS SocsoBrackets (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                PayStructureId INTEGER NOT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                MinAge INTEGER NULL,
                MaxAge INTEGER NULL,
                MinMonthlySalary REAL NULL,
                MaxMonthlySalary REAL NULL,
                EmployerAmount REAL NOT NULL DEFAULT 0,
                EmployeeAmount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (PayStructureId) REFERENCES PayStructures(Id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS PayrollRuns (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                CompanyId INTEGER NOT NULL,
                Year INTEGER NOT NULL,
                Month INTEGER NOT NULL,
                PayCycle TEXT NOT NULL,
                PayType TEXT NOT NULL,
                CountryCode TEXT NOT NULL,
                PeriodLabel TEXT NOT NULL,
                PeriodStart TEXT NOT NULL,
                PeriodEnd TEXT NOT NULL,
                ProcessedAt TEXT NOT NULL,
                TotalGross REAL NOT NULL DEFAULT 0,
                TotalPayout REAL NOT NULL DEFAULT 0,
                EmployeeCount INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (CompanyId) REFERENCES Companies(Id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS PayrollRunLines (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                PayrollRunId INTEGER NOT NULL,
                EmployeeId INTEGER NOT NULL,
                EmployeeCode TEXT NOT NULL,
                EmployeeName TEXT NOT NULL,
                Department TEXT NOT NULL,
                Position TEXT NOT NULL,
                PresentDays REAL NOT NULL DEFAULT 0,
                WorkingDays REAL NOT NULL DEFAULT 0,
                TotalHours REAL NOT NULL DEFAULT 0,
                OvertimeHours REAL NOT NULL DEFAULT 0,
                AttendanceRatio REAL NOT NULL DEFAULT 0,
                BaseSalary REAL NOT NULL DEFAULT 0,
                ServiceAllowance REAL NOT NULL DEFAULT 0,
                AccommodationAllowance REAL NOT NULL DEFAULT 0,
                TransportAllowance REAL NOT NULL DEFAULT 0,
                MobileAllowance REAL NOT NULL DEFAULT 0,
                BonusAmount REAL NOT NULL DEFAULT 0,
                OvertimeAmount REAL NOT NULL DEFAULT 0,
                EpfEmployeeAmount REAL NOT NULL DEFAULT 0,
                EpfEmployerAmount REAL NOT NULL DEFAULT 0,
                SocsoEmployeeAmount REAL NOT NULL DEFAULT 0,
                SocsoEmployerAmount REAL NOT NULL DEFAULT 0,
                IncomeTaxAmount REAL NOT NULL DEFAULT 0,
                GrossPay REAL NOT NULL DEFAULT 0,
                TotalPayout REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (PayrollRunId) REFERENCES PayrollRuns(Id) ON DELETE CASCADE
            )
            """,
            "CREATE UNIQUE INDEX IF NOT EXISTS IX_PayrollRuns_CompanyId_Year_Month ON PayrollRuns(CompanyId, Year, Month)",
            """
            CREATE TABLE IF NOT EXISTS IncomeTaxYears (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                CompanyId INTEGER NOT NULL,
                Year INTEGER NOT NULL,
                CountryCode TEXT NOT NULL,
                Active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (CompanyId) REFERENCES Companies(Id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS IncomeTaxBrackets (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                IncomeTaxYearId INTEGER NOT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                MinAnnualChargeableIncome REAL NOT NULL DEFAULT 0,
                MaxAnnualChargeableIncome REAL NULL,
                RatePct REAL NOT NULL DEFAULT 0,
                BaseMinTaxAmount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (IncomeTaxYearId) REFERENCES IncomeTaxYears(Id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS IncomeTaxReliefs (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                IncomeTaxYearId INTEGER NOT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                Name TEXT NOT NULL,
                Amount REAL NOT NULL DEFAULT 0,
                IsMaximum INTEGER NOT NULL DEFAULT 0,
                ApplyCondition TEXT NULL,
                FOREIGN KEY (IncomeTaxYearId) REFERENCES IncomeTaxYears(Id) ON DELETE CASCADE
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS IncomeTaxRebates (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                IncomeTaxYearId INTEGER NOT NULL,
                SortOrder INTEGER NOT NULL DEFAULT 0,
                Name TEXT NOT NULL,
                Amount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (IncomeTaxYearId) REFERENCES IncomeTaxYears(Id) ON DELETE CASCADE
            )
            """,
            "CREATE UNIQUE INDEX IF NOT EXISTS IX_IncomeTaxYears_CompanyId_Year ON IncomeTaxYears(CompanyId, Year)",
        })
        {
            try { await db.Database.ExecuteSqlRawAsync(sql); }
            catch { /* table or index already exists */ }
        }

        try
        {
            await db.Database.ExecuteSqlRawAsync("UPDATE Employees SET PayrollPin = '000000', PayrollPinMustChange = 1 WHERE PayrollPin IS NULL OR PayrollPin = ''");
        }
        catch { /* HR tables may not exist yet */ }

        await EmployeeLevelNormalizer.NormalizeAsync(db);

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

        await OrgSeeder.SeedAsync(db);
        await EmployeeSeeder.SeedAsync(db);
        await PayrollDemoSeeder.SeedAsync(db);
    }
}
