using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class HrStartup
{
    public static async Task InitializeAsync(BisyncDbContext db)
    {
        await HrSchemaPatcher.ApplyAsync(db);

        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "PosPin", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "PosPinMustChange", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "ReportsToId", "INTEGER NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "EmployeeLevels", "IsShift", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "EmployeeLevels", "ShiftType", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "EmployeeLevels", "Active", "BOOLEAN NOT NULL DEFAULT true");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "CompanySettings", "OperatingCountryCode", "TEXT NOT NULL DEFAULT 'MY'");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "CompanySettings", "ReplacementPublicHolidayEnabled", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "CompanySettings", "GazettedPhReplacementDayEnabled", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "CompanySettings", "GazettedPhNormalHoursRate", "DOUBLE PRECISION NOT NULL DEFAULT 1.5");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "CompanySettings", "GazettedPhOvertimeHoursRate", "DOUBLE PRECISION NOT NULL DEFAULT 2.0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "CompanySettings", "NonGazettedPhReplacementDayEnabled", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "AttendanceRecords", "RphAccruedDays", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PublicHolidays", "CountryCode", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PublicHolidays", "CatalogKey", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PublicHolidays", "IsRecurringAnnually", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PublicHolidays", "IsGazetted", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "DivisionId", "INTEGER NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "DepartmentId", "INTEGER NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "Active", "BOOLEAN NOT NULL DEFAULT true");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "CheckinMethod", "TEXT NOT NULL DEFAULT 'Biometrics'");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "PayrollPin", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "PayrollPinMustChange", "BOOLEAN NOT NULL DEFAULT true");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BaseSalary", "DOUBLE PRECISION NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "ServiceAllowance", "DOUBLE PRECISION NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "TransportAllowance", "DOUBLE PRECISION NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "AccommodationAllowance", "DOUBLE PRECISION NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "MobileAllowance", "DOUBLE PRECISION NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "OtherAllowancesJson", "TEXT NOT NULL DEFAULT '[]'");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "WorkPermitByCompany", "BOOLEAN NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "TransportProvided", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "TransportCarModel", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "TransportPlateNumber", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "AccommodationProvided", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "AccommodationAddress", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "AccommodationLeasingPeriod", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "MobileProvided", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "MobileAllowancePhone", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "MobileProvider", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "OvertimeAllowanceEnabled", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "AccommodationLeaseStart", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "AccommodationLeaseEnd", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BonusEnabled", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BonusMonthly", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BonusAnnually", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BonusAmount", "DOUBLE PRECISION NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BonusByBasicSalary", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BonusByService", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BankName", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BankAccountNumber", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "BankAccountHolderName", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "Employees", "MaritalStatus", "TEXT NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRuns", "TotalPayout", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "OvertimeHours", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "ServiceAllowance", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "AccommodationAllowance", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "TransportAllowance", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "MobileAllowance", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "EpfEmployeeAmount", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "EpfEmployerAmount", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "SocsoEmployeeAmount", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "SocsoEmployerAmount", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "IncomeTaxAmount", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayrollRunLines", "TotalPayout", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayStructures", "OvertimeRateMultiplier", "DOUBLE PRECISION NOT NULL DEFAULT 1.5");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayStructures", "OvertimeCalculationMode", "TEXT NOT NULL DEFAULT 'Calculated'");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayStructures", "OvertimeFixedHourlyRate", "DOUBLE PRECISION NULL");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayStructures", "ForeignProvidentFundEmployerPct", "DOUBLE PRECISION NOT NULL DEFAULT 2");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayStructures", "ForeignProvidentFundEmployeePct", "DOUBLE PRECISION NOT NULL DEFAULT 2");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "PayStructures", "ForeignSocsoEmployerPct", "DOUBLE PRECISION NOT NULL DEFAULT 1.25");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "IncomeTaxBrackets", "BaseMinTaxAmount", "DOUBLE PRECISION NOT NULL DEFAULT 0");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "IncomeTaxReliefs", "IsMaximum", "BOOLEAN NOT NULL DEFAULT false");
        await DatabaseSchemaHelper.EnsureColumnAsync(db, "IncomeTaxReliefs", "ApplyCondition", "TEXT NULL");

        try
        {
            await db.Database.ExecuteSqlRawAsync("""UPDATE "PublicHolidays" SET "CountryCode" = 'MY' WHERE "CountryCode" IS NULL""");
            await db.Database.ExecuteSqlRawAsync(
                """UPDATE "PublicHolidays" SET "IsGazetted" = true WHERE "CatalogKey" IS NOT NULL AND "CatalogKey" NOT LIKE 'CUSTOM|%'""");
        }
        catch { /* HR tables may not exist yet */ }

        try
        {
            await db.Database.ExecuteSqlRawAsync("""UPDATE "CompanySettings" SET "OperatingCountryCode" = 'MY' WHERE "OperatingCountryCode" IS NULL OR "OperatingCountryCode" = ''""");
            await db.Database.ExecuteSqlRawAsync("""
                UPDATE "CompanySettings" SET
                    "GazettedPhReplacementDayEnabled" = "ReplacementPublicHolidayEnabled"
                WHERE "GazettedPhReplacementDayEnabled" = false AND "ReplacementPublicHolidayEnabled" = true
                """);
            await db.Database.ExecuteSqlRawAsync("""
                UPDATE "CompanySettings" SET
                    "GazettedPhNormalHoursRate" = "PublicHolidayPayMultiplier"
                WHERE "GazettedPhNormalHoursRate" = 1.5 AND "PublicHolidayPayMultiplier" != 1.5
                """);
        }
        catch { /* HR tables may not exist yet */ }

        foreach (var sql in PayrollTableSql)
        {
            try { await db.Database.ExecuteSqlRawAsync(sql); }
            catch { /* table or index already exists */ }
        }

        try
        {
            await db.Database.ExecuteSqlRawAsync("""UPDATE "Employees" SET "PayrollPin" = '000000', "PayrollPinMustChange" = true WHERE "PayrollPin" IS NULL OR "PayrollPin" = ''""");
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
        await DatabaseSchemaHelper.ResyncCoreIdentitySequencesAsync(db);
    }

    static readonly string[] PayrollTableSql =
    [
        """
        CREATE TABLE IF NOT EXISTS "PayStructures" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "CompanyId" INTEGER NOT NULL UNIQUE,
            "CountryCode" TEXT NOT NULL,
            "PayType" TEXT NOT NULL,
            "PayCycle" TEXT NOT NULL,
            "ProvidentFundEmployerPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "ProvidentFundEmployeePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "Active" BOOLEAN NOT NULL DEFAULT true,
            "TransportationAllowanceAmount" DOUBLE PRECISION NULL,
            "TransportationProvided" BOOLEAN NOT NULL DEFAULT false,
            "TransportationContactMobile" TEXT NULL,
            "MobileAllowanceAmount" DOUBLE PRECISION NULL,
            "MobileProvided" BOOLEAN NOT NULL DEFAULT false,
            "CompanyVehicleAsRequired" BOOLEAN NOT NULL DEFAULT false,
            "AccommodationAmount" DOUBLE PRECISION NULL,
            "AccommodationFrequency" TEXT NULL,
            "AccommodationProvided" BOOLEAN NOT NULL DEFAULT false,
            "AccommodationAddress" TEXT NULL,
            "AccommodationLeaseDueDate" TEXT NULL,
            FOREIGN KEY ("CompanyId") REFERENCES "Companies"("Id") ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS "MandatoryContributions" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "PayStructureId" INTEGER NOT NULL,
            "Name" TEXT NOT NULL,
            "EmployerPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "EmployeePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
            FOREIGN KEY ("PayStructureId") REFERENCES "PayStructures"("Id") ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS "ProvidentFundBrackets" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "PayStructureId" INTEGER NOT NULL,
            "SortOrder" INTEGER NOT NULL DEFAULT 0,
            "MinAge" INTEGER NULL,
            "MaxAge" INTEGER NULL,
            "MinMonthlySalary" DOUBLE PRECISION NULL,
            "MaxMonthlySalary" DOUBLE PRECISION NULL,
            "EmployerPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "EmployeePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "NoContribution" BOOLEAN NOT NULL DEFAULT false,
            FOREIGN KEY ("PayStructureId") REFERENCES "PayStructures"("Id") ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS "SocsoBrackets" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "PayStructureId" INTEGER NOT NULL,
            "SortOrder" INTEGER NOT NULL DEFAULT 0,
            "MinAge" INTEGER NULL,
            "MaxAge" INTEGER NULL,
            "MinMonthlySalary" DOUBLE PRECISION NULL,
            "MaxMonthlySalary" DOUBLE PRECISION NULL,
            "EmployerAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "EmployeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            FOREIGN KEY ("PayStructureId") REFERENCES "PayStructures"("Id") ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS "PayrollRuns" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "CompanyId" INTEGER NOT NULL,
            "Year" INTEGER NOT NULL,
            "Month" INTEGER NOT NULL,
            "PayCycle" TEXT NOT NULL,
            "PayType" TEXT NOT NULL,
            "CountryCode" TEXT NOT NULL,
            "PeriodLabel" TEXT NOT NULL,
            "PeriodStart" TEXT NOT NULL,
            "PeriodEnd" TEXT NOT NULL,
            "ProcessedAt" TEXT NOT NULL,
            "TotalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "TotalPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "EmployeeCount" INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY ("CompanyId") REFERENCES "Companies"("Id") ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS "PayrollRunLines" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "PayrollRunId" INTEGER NOT NULL,
            "EmployeeId" INTEGER NOT NULL,
            "EmployeeCode" TEXT NOT NULL,
            "EmployeeName" TEXT NOT NULL,
            "Department" TEXT NOT NULL,
            "Position" TEXT NOT NULL,
            "PresentDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "WorkingDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "TotalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "OvertimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "AttendanceRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "BaseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "ServiceAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "AccommodationAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "TransportAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "MobileAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "BonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "OvertimeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "EpfEmployeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "EpfEmployerAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "SocsoEmployeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "SocsoEmployerAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "IncomeTaxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "GrossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "TotalPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
            FOREIGN KEY ("PayrollRunId") REFERENCES "PayrollRuns"("Id") ON DELETE CASCADE
        )
        """,
        """CREATE UNIQUE INDEX IF NOT EXISTS "IX_PayrollRuns_CompanyId_Year_Month" ON "PayrollRuns"("CompanyId", "Year", "Month")""",
        """
        CREATE TABLE IF NOT EXISTS "IncomeTaxYears" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "CompanyId" INTEGER NOT NULL,
            "Year" INTEGER NOT NULL,
            "CountryCode" TEXT NOT NULL,
            "Active" BOOLEAN NOT NULL DEFAULT true,
            FOREIGN KEY ("CompanyId") REFERENCES "Companies"("Id") ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS "IncomeTaxBrackets" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "IncomeTaxYearId" INTEGER NOT NULL,
            "SortOrder" INTEGER NOT NULL DEFAULT 0,
            "MinAnnualChargeableIncome" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "MaxAnnualChargeableIncome" DOUBLE PRECISION NULL,
            "RatePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "BaseMinTaxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            FOREIGN KEY ("IncomeTaxYearId") REFERENCES "IncomeTaxYears"("Id") ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS "IncomeTaxReliefs" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "IncomeTaxYearId" INTEGER NOT NULL,
            "SortOrder" INTEGER NOT NULL DEFAULT 0,
            "Name" TEXT NOT NULL,
            "Amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            "IsMaximum" BOOLEAN NOT NULL DEFAULT false,
            "ApplyCondition" TEXT NULL,
            FOREIGN KEY ("IncomeTaxYearId") REFERENCES "IncomeTaxYears"("Id") ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS "IncomeTaxRebates" (
            "Id" integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            "IncomeTaxYearId" INTEGER NOT NULL,
            "SortOrder" INTEGER NOT NULL DEFAULT 0,
            "Name" TEXT NOT NULL,
            "Amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
            FOREIGN KEY ("IncomeTaxYearId") REFERENCES "IncomeTaxYears"("Id") ON DELETE CASCADE
        )
        """,
        """CREATE UNIQUE INDEX IF NOT EXISTS "IX_IncomeTaxYears_CompanyId_Year" ON "IncomeTaxYears"("CompanyId", "Year")""",
    ];
}
