using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class HrModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Employee>(e =>
        {
            e.Property(x => x.EmployeeCode).HasMaxLength(20);
            e.HasIndex(x => x.EmployeeCode).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(256);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Mobile).HasMaxLength(30);
            e.Property(x => x.Department).HasMaxLength(100);
            e.Property(x => x.Position).HasMaxLength(100);
            e.Property(x => x.ShiftType).HasMaxLength(100);
            e.Property(x => x.Nationality).HasMaxLength(100);
            e.Property(x => x.IdPassportNumber).HasMaxLength(50);
            e.Property(x => x.PersonalEmail).HasMaxLength(256);
            e.Property(x => x.PermanentAddress).HasMaxLength(500);
            e.Property(x => x.WorkingHoursPerDay).HasPrecision(4, 2);

            e.HasOne(x => x.EmployeeLevel)
                .WithMany()
                .HasForeignKey(x => x.EmployeeLevelId)
                .OnDelete(DeleteBehavior.SetNull);

            e.Property(x => x.PosPin).HasMaxLength(10);
            e.Property(x => x.CheckinMethod).HasConversion<string>().HasMaxLength(20);
            e.HasOne(x => x.ReportsTo)
                .WithMany()
                .HasForeignKey(x => x.ReportsToId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasOne(x => x.Division)
                .WithMany()
                .HasForeignKey(x => x.DivisionId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasOne(x => x.AssignedDepartment)
                .WithMany()
                .HasForeignKey(x => x.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<EducationRecord>(e =>
        {
            e.Property(x => x.Degree).HasMaxLength(200);
            e.Property(x => x.Institution).HasMaxLength(200);
            e.Property(x => x.Year).HasMaxLength(10);
            e.Property(x => x.Certificate).HasMaxLength(200);
            e.HasOne(x => x.Employee)
                .WithMany(x => x.Education)
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PreviousEmployment>(e =>
        {
            e.Property(x => x.CompanyName).HasMaxLength(200);
            e.Property(x => x.Position).HasMaxLength(100);
            e.Property(x => x.StartYear).HasMaxLength(10);
            e.Property(x => x.EndYear).HasMaxLength(10);
            e.Property(x => x.YearsOfService).HasPrecision(4, 1);
            e.HasOne(x => x.Employee)
                .WithMany(x => x.PreviousEmployments)
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EmployeeMovement>(e =>
        {
            e.Property(x => x.FromPosition).HasMaxLength(100);
            e.Property(x => x.ToPosition).HasMaxLength(100);
            e.Property(x => x.Department).HasMaxLength(100);
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.HasOne(x => x.Employee)
                .WithMany(x => x.Movements)
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PerformanceAppraisal>(e =>
        {
            e.Property(x => x.Year).HasMaxLength(10);
            e.Property(x => x.Rating).HasMaxLength(50);
            e.Property(x => x.Reviewer).HasMaxLength(200);
            e.Property(x => x.Comments).HasMaxLength(2000);
            e.Property(x => x.Score).HasPrecision(3, 1);
            e.HasIndex(x => new { x.EmployeeId, x.Year }).IsUnique();
            e.HasOne(x => x.Employee)
                .WithMany(x => x.PerformanceAppraisals)
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AttendanceRecord>(e =>
        {
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => new { x.EmployeeId, x.Date }).IsUnique();
            e.HasOne(x => x.Employee)
                .WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LeaveRequest>(e =>
        {
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(10);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Reason).HasMaxLength(1000);
            e.HasIndex(x => x.Status);
            e.HasOne(x => x.Employee)
                .WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LeaveBalance>(e =>
        {
            e.HasKey(x => x.EmployeeId);
            e.Property(x => x.RdoBalance).HasPrecision(5, 1);
            e.Property(x => x.RphBalance).HasPrecision(5, 1);
            e.Property(x => x.AlBalance).HasPrecision(5, 1);
            e.HasOne(x => x.Employee)
                .WithOne(x => x.LeaveBalance)
                .HasForeignKey<LeaveBalance>(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ShiftSchedule>(e =>
        {
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(10);
            e.HasIndex(x => new { x.EmployeeId, x.Date }).IsUnique();
            e.HasOne(x => x.Employee)
                .WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PublicHoliday>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.CountryCode).HasMaxLength(2);
            e.Property(x => x.CatalogKey).HasMaxLength(120);
            e.HasIndex(x => x.Date);
            e.HasIndex(x => new { x.CountryCode, x.CatalogKey });
        });

        modelBuilder.Entity<EmployeeLevel>(e =>
        {
            e.Property(x => x.LevelName).HasMaxLength(100);
            e.HasIndex(x => x.LevelName).IsUnique();
            e.Property(x => x.WorkingHoursPerDay).HasPrecision(4, 2);
            e.Property(x => x.BreakHoursPerShift).HasPrecision(4, 2);
            e.Property(x => x.ShiftType).HasMaxLength(100);
        });

        modelBuilder.Entity<CompanySetting>(e =>
        {
            e.Property(x => x.PublicHolidayPayMultiplier).HasPrecision(4, 2);
            e.Property(x => x.OperatingCountryCode).HasMaxLength(2);
        });

        modelBuilder.Entity<Division>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
            e.Property(x => x.Code).HasMaxLength(20);
            e.HasIndex(x => x.Name).IsUnique();
        });

        modelBuilder.Entity<Department>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(100);
            e.HasIndex(x => new { x.DivisionId, x.Name }).IsUnique();
            e.HasOne(x => x.Division)
                .WithMany(x => x.Departments)
                .HasForeignKey(x => x.DivisionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        SeedReferenceData(modelBuilder);
    }

    static void SeedReferenceData(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<EmployeeLevel>().HasData(
            new EmployeeLevel { Id = 1, LevelName = "Junior", AnnualLeaveDays = 12, SickLeaveDays = 14, OvertimeEligible = true, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = true, IsShift = true, ShiftType = "Morning Shift" },
            new EmployeeLevel { Id = 2, LevelName = "Mid-Level", AnnualLeaveDays = 16, SickLeaveDays = 14, OvertimeEligible = true, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = true, IsShift = true, ShiftType = "Flexible Shift" },
            new EmployeeLevel { Id = 3, LevelName = "Senior", AnnualLeaveDays = 20, SickLeaveDays = 18, OvertimeEligible = true, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = true },
            new EmployeeLevel { Id = 4, LevelName = "Manager", AnnualLeaveDays = 24, SickLeaveDays = 22, OvertimeEligible = false, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = false },
            new EmployeeLevel { Id = 5, LevelName = "Director", AnnualLeaveDays = 28, SickLeaveDays = 30, OvertimeEligible = false, WorkingHoursPerDay = 8, BreakHoursPerShift = 1, PublicHolidayEligible = false });

        modelBuilder.Entity<PublicHoliday>().HasData(
            new PublicHoliday { Id = 1, Name = "New Year's Day", Date = new DateOnly(2026, 1, 1), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 2, Name = "Chinese New Year", Date = new DateOnly(2026, 1, 29), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 3, Name = "Chinese New Year (2nd day)", Date = new DateOnly(2026, 1, 30), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 4, Name = "Thaipusam", Date = new DateOnly(2026, 2, 3), IsRecognized = false, CountryCode = "MY" },
            new PublicHoliday { Id = 5, Name = "Federal Territory Day", Date = new DateOnly(2026, 2, 1), IsRecognized = false, CountryCode = "MY" },
            new PublicHoliday { Id = 6, Name = "Labour Day", Date = new DateOnly(2026, 5, 1), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 7, Name = "Wesak Day", Date = new DateOnly(2026, 5, 11), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 8, Name = "Agong's Birthday", Date = new DateOnly(2026, 6, 6), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 9, Name = "Hari Raya Aidilfitri", Date = new DateOnly(2026, 6, 17), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 10, Name = "Hari Raya Aidilfitri (2nd day)", Date = new DateOnly(2026, 6, 18), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 11, Name = "Hari Raya Aidiladha", Date = new DateOnly(2026, 8, 24), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 12, Name = "Merdeka Day", Date = new DateOnly(2026, 8, 31), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 13, Name = "Malaysia Day", Date = new DateOnly(2026, 9, 16), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 14, Name = "Awal Muharram", Date = new DateOnly(2026, 9, 14), IsRecognized = false, CountryCode = "MY" },
            new PublicHoliday { Id = 15, Name = "Prophet Muhammad's Birthday", Date = new DateOnly(2026, 11, 23), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 16, Name = "Deepavali", Date = new DateOnly(2026, 11, 5), IsRecognized = true, CountryCode = "MY" },
            new PublicHoliday { Id = 17, Name = "Christmas Day", Date = new DateOnly(2026, 12, 25), IsRecognized = true, CountryCode = "MY" });

        modelBuilder.Entity<CompanySetting>().HasData(
            new CompanySetting { Id = 1, PublicHolidayPayMultiplier = 1.5m, OperatingCountryCode = "MY" });
    }
}
