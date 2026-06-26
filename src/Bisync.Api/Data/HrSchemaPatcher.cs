using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>Creates core HR tables on the shared Bisync SQLite database when they are missing.</summary>
public static class HrSchemaPatcher
{
    public static async Task ApplyAsync(BisyncDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "EmployeeLevels" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_EmployeeLevels" PRIMARY KEY AUTOINCREMENT,
                "LevelName" TEXT NOT NULL,
                "AnnualLeaveDays" INTEGER NOT NULL,
                "SickLeaveDays" INTEGER NOT NULL,
                "OvertimeEligible" INTEGER NOT NULL,
                "WorkingHoursPerDay" REAL NOT NULL,
                "BreakHoursPerShift" REAL NOT NULL,
                "PublicHolidayEligible" INTEGER NOT NULL,
                "IsShift" INTEGER NOT NULL DEFAULT 0,
                "ShiftType" TEXT NULL
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Employees" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_Employees" PRIMARY KEY AUTOINCREMENT,
                "EmployeeCode" TEXT NOT NULL,
                "Name" TEXT NOT NULL,
                "Email" TEXT NOT NULL,
                "Mobile" TEXT NOT NULL,
                "Department" TEXT NOT NULL,
                "Position" TEXT NOT NULL,
                "JoinDate" TEXT NOT NULL,
                "FingerprintEnrolled" INTEGER NOT NULL,
                "FaceRecognitionEnrolled" INTEGER NOT NULL,
                "IsShiftEmployee" INTEGER NOT NULL,
                "ShiftType" TEXT NULL,
                "PosEnabled" INTEGER NOT NULL,
                "BisyncEnabled" INTEGER NOT NULL,
                "WorkingHoursPerDay" REAL NOT NULL,
                "EmployeeLevelId" INTEGER NULL,
                "Nationality" TEXT NULL,
                "IdPassportNumber" TEXT NULL,
                "DateOfBirth" TEXT NULL,
                "PersonalEmail" TEXT NULL,
                "PermanentAddress" TEXT NULL,
                "PosPin" TEXT NULL,
                "PosPinMustChange" INTEGER NOT NULL DEFAULT 0,
                "ReportsToId" INTEGER NULL,
                "DivisionId" INTEGER NULL,
                "DepartmentId" INTEGER NULL,
                "Active" INTEGER NOT NULL DEFAULT 1,
                "CheckinMethod" TEXT NOT NULL DEFAULT 'Biometrics',
                FOREIGN KEY("EmployeeLevelId") REFERENCES "EmployeeLevels"("Id")
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "LeaveBalances" (
                "EmployeeId" INTEGER NOT NULL CONSTRAINT "PK_LeaveBalances" PRIMARY KEY,
                "RdoBalance" REAL NOT NULL DEFAULT 0,
                "RphBalance" REAL NOT NULL DEFAULT 0,
                "AlBalance" REAL NOT NULL DEFAULT 0,
                FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "CompanySettings" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_CompanySettings" PRIMARY KEY AUTOINCREMENT,
                "PublicHolidayPayMultiplier" REAL NOT NULL DEFAULT 1.5,
                "OperatingCountryCode" TEXT NOT NULL DEFAULT 'MY',
                "ReplacementPublicHolidayEnabled" INTEGER NOT NULL DEFAULT 0
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "PublicHolidays" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_PublicHolidays" PRIMARY KEY AUTOINCREMENT,
                "Name" TEXT NOT NULL,
                "Date" TEXT NOT NULL,
                "IsRecognized" INTEGER NOT NULL,
                "CountryCode" TEXT NULL,
                "CatalogKey" TEXT NULL
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "AttendanceRecords" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_AttendanceRecords" PRIMARY KEY AUTOINCREMENT,
                "EmployeeId" INTEGER NOT NULL,
                "Date" TEXT NOT NULL,
                "Status" TEXT NOT NULL,
                "ScheduledIn" TEXT NULL,
                "ScheduledOut" TEXT NULL,
                "ActualIn" TEXT NULL,
                "ActualOut" TEXT NULL,
                "RphAccruedDays" REAL NOT NULL DEFAULT 0,
                FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "LeaveRequests" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_LeaveRequests" PRIMARY KEY AUTOINCREMENT,
                "EmployeeId" INTEGER NOT NULL,
                "Type" TEXT NOT NULL,
                "StartDate" TEXT NOT NULL,
                "EndDate" TEXT NOT NULL,
                "Status" TEXT NOT NULL,
                "Reason" TEXT NULL,
                FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ShiftSchedules" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_ShiftSchedules" PRIMARY KEY AUTOINCREMENT,
                "EmployeeId" INTEGER NOT NULL,
                "Date" TEXT NOT NULL,
                "StartTime" TEXT NULL,
                "EndTime" TEXT NULL,
                "Type" TEXT NOT NULL,
                FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "EducationRecords" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_EducationRecords" PRIMARY KEY AUTOINCREMENT,
                "EmployeeId" INTEGER NOT NULL,
                "Degree" TEXT NOT NULL,
                "Institution" TEXT NOT NULL,
                "Year" TEXT NOT NULL,
                "Certificate" TEXT NOT NULL,
                FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "PreviousEmployments" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_PreviousEmployments" PRIMARY KEY AUTOINCREMENT,
                "EmployeeId" INTEGER NOT NULL,
                "CompanyName" TEXT NOT NULL,
                "Position" TEXT NOT NULL,
                "StartYear" TEXT NOT NULL,
                "EndYear" TEXT NOT NULL,
                "YearsOfService" REAL NOT NULL,
                FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "EmployeeMovements" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_EmployeeMovements" PRIMARY KEY AUTOINCREMENT,
                "EmployeeId" INTEGER NOT NULL,
                "Date" TEXT NOT NULL,
                "FromPosition" TEXT NOT NULL,
                "ToPosition" TEXT NOT NULL,
                "Type" TEXT NOT NULL,
                "Department" TEXT NOT NULL,
                FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "PerformanceAppraisals" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_PerformanceAppraisals" PRIMARY KEY AUTOINCREMENT,
                "EmployeeId" INTEGER NOT NULL,
                "Year" TEXT NOT NULL,
                "Rating" TEXT NOT NULL,
                "Score" REAL NOT NULL,
                "Reviewer" TEXT NOT NULL,
                "Comments" TEXT NULL,
                FOREIGN KEY("EmployeeId") REFERENCES "Employees"("Id") ON DELETE CASCADE
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Divisions" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_Divisions" PRIMARY KEY AUTOINCREMENT,
                "Name" TEXT NOT NULL,
                "Code" TEXT NULL
            );
            """);

        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Departments" (
                "Id" INTEGER NOT NULL CONSTRAINT "PK_Departments" PRIMARY KEY AUTOINCREMENT,
                "Name" TEXT NOT NULL,
                "DivisionId" INTEGER NOT NULL,
                FOREIGN KEY("DivisionId") REFERENCES "Divisions"("Id") ON DELETE CASCADE
            );
            """);

        await TryCreateIndexAsync(db, """CREATE UNIQUE INDEX IF NOT EXISTS "IX_Employees_EmployeeCode" ON "Employees" ("EmployeeCode");""");
        await TryCreateIndexAsync(db, """CREATE UNIQUE INDEX IF NOT EXISTS "IX_Employees_Email" ON "Employees" ("Email");""");
        await TryCreateIndexAsync(db, """CREATE UNIQUE INDEX IF NOT EXISTS "IX_EmployeeLevels_LevelName" ON "EmployeeLevels" ("LevelName");""");
        await TryCreateIndexAsync(db, """CREATE UNIQUE INDEX IF NOT EXISTS "IX_Divisions_Name" ON "Divisions" ("Name");""");
        await TryCreateIndexAsync(db, """CREATE UNIQUE INDEX IF NOT EXISTS "IX_Departments_DivisionId_Name" ON "Departments" ("DivisionId", "Name");""");
        await TryCreateIndexAsync(db, """CREATE UNIQUE INDEX IF NOT EXISTS "IX_AttendanceRecords_EmployeeId_Date" ON "AttendanceRecords" ("EmployeeId", "Date");""");
        await TryCreateIndexAsync(db, """CREATE UNIQUE INDEX IF NOT EXISTS "IX_ShiftSchedules_EmployeeId_Date" ON "ShiftSchedules" ("EmployeeId", "Date");""");
        await TryCreateIndexAsync(db, """CREATE UNIQUE INDEX IF NOT EXISTS "IX_PerformanceAppraisals_EmployeeId_Year" ON "PerformanceAppraisals" ("EmployeeId", "Year");""");

        await SeedEmployeeLevelsAsync(db);
        await SeedCompanySettingsAsync(db);
        await SeedPublicHolidaysAsync(db);
    }

    static async Task SeedEmployeeLevelsAsync(BisyncDbContext db)
    {
        if (await db.EmployeeLevels.AnyAsync()) return;

        db.EmployeeLevels.AddRange(
            new Models.EmployeeLevel { Id = 1, LevelName = "Junior", AnnualLeaveDays = 12, SickLeaveDays = 14, OvertimeEligible = true, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = true, IsShift = true, ShiftType = "Morning Shift" },
            new Models.EmployeeLevel { Id = 2, LevelName = "Mid-Level", AnnualLeaveDays = 16, SickLeaveDays = 14, OvertimeEligible = true, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = true, IsShift = true, ShiftType = "Flexible Shift" },
            new Models.EmployeeLevel { Id = 3, LevelName = "Senior", AnnualLeaveDays = 20, SickLeaveDays = 18, OvertimeEligible = true, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = true },
            new Models.EmployeeLevel { Id = 4, LevelName = "Manager", AnnualLeaveDays = 24, SickLeaveDays = 22, OvertimeEligible = false, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = false },
            new Models.EmployeeLevel { Id = 5, LevelName = "Director", AnnualLeaveDays = 28, SickLeaveDays = 30, OvertimeEligible = false, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = false }
        );
        await db.SaveChangesAsync();
    }

    static async Task SeedCompanySettingsAsync(BisyncDbContext db)
    {
        if (await db.CompanySettings.AnyAsync()) return;
        db.CompanySettings.Add(new Models.CompanySetting { Id = 1, PublicHolidayPayMultiplier = 1.5m, OperatingCountryCode = "MY" });
        await db.SaveChangesAsync();
    }

    static async Task SeedPublicHolidaysAsync(BisyncDbContext db)
    {
        if (await db.PublicHolidays.AnyAsync()) return;
        db.PublicHolidays.AddRange(
            new Models.PublicHoliday { Id = 1, Name = "New Year's Day", Date = new DateOnly(2026, 1, 1), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 2, Name = "Chinese New Year", Date = new DateOnly(2026, 1, 29), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 3, Name = "Chinese New Year (2nd day)", Date = new DateOnly(2026, 1, 30), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 4, Name = "Thaipusam", Date = new DateOnly(2026, 2, 3), IsRecognized = false, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 5, Name = "Federal Territory Day", Date = new DateOnly(2026, 2, 1), IsRecognized = false, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 6, Name = "Labour Day", Date = new DateOnly(2026, 5, 1), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 7, Name = "Wesak Day", Date = new DateOnly(2026, 5, 11), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 8, Name = "Agong's Birthday", Date = new DateOnly(2026, 6, 6), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 9, Name = "Hari Raya Aidilfitri", Date = new DateOnly(2026, 6, 17), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 10, Name = "Hari Raya Aidilfitri (2nd day)", Date = new DateOnly(2026, 6, 18), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 11, Name = "Hari Raya Aidiladha", Date = new DateOnly(2026, 8, 24), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 12, Name = "Merdeka Day", Date = new DateOnly(2026, 8, 31), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 13, Name = "Malaysia Day", Date = new DateOnly(2026, 9, 16), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 14, Name = "Awal Muharram", Date = new DateOnly(2026, 9, 14), IsRecognized = false, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 15, Name = "Prophet Muhammad's Birthday", Date = new DateOnly(2026, 11, 23), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 16, Name = "Deepavali", Date = new DateOnly(2026, 11, 5), IsRecognized = true, CountryCode = "MY" },
            new Models.PublicHoliday { Id = 17, Name = "Christmas Day", Date = new DateOnly(2026, 12, 25), IsRecognized = true, CountryCode = "MY" }
        );
        await db.SaveChangesAsync();
    }

    static async Task TryCreateIndexAsync(BisyncDbContext db, string sql)
    {
        try { await db.Database.ExecuteSqlRawAsync(sql); }
        catch { /* index already exists */ }
    }
}
