using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>Consolidates employee levels to Junior, Management, and Director.</summary>
public static class EmployeeLevelNormalizer
{
    static readonly string[] AllowedNames = ["Junior", "Management", "Director"];

    public static async Task NormalizeAsync(BisyncDbContext db)
    {
        await RemapLegacyEmployeeLevelsAsync(db);
        await EnsureCanonicalLevelsAsync(db);
        await RemoveExtraLevelsAsync(db);
        await db.SaveChangesAsync();
    }

    static async Task RemapLegacyEmployeeLevelsAsync(BisyncDbContext db)
    {
        var levels = await db.EmployeeLevels.AsNoTracking().ToListAsync();
        if (levels.Count == 0) return;

        var byName = levels.ToDictionary(l => l.LevelName, l => l.Id, StringComparer.OrdinalIgnoreCase);

        // Legacy Mid-Level -> Junior
        if (byName.TryGetValue("Mid-Level", out var midId))
            await SetEmployeeLevelAsync(db, midId, 1);

        // Legacy Senior / Manager -> Management
        foreach (var name in new[] { "Senior", "Manager" })
        {
            if (byName.TryGetValue(name, out var id))
                await SetEmployeeLevelAsync(db, id, 2);
        }

        // Legacy Director (id 5) -> Director (id 3)
        if (byName.TryGetValue("Director", out var directorId) && directorId != 3)
            await SetEmployeeLevelAsync(db, directorId, 3);
    }

    static async Task SetEmployeeLevelAsync(BisyncDbContext db, int fromId, int toId)
    {
        if (fromId == toId) return;
        await db.Employees
            .Where(e => e.EmployeeLevelId == fromId)
            .ExecuteUpdateAsync(s => s.SetProperty(e => e.EmployeeLevelId, toId));
    }

    static async Task EnsureCanonicalLevelsAsync(BisyncDbContext db)
    {
        await UpsertLevelAsync(db, 1, new EmployeeLevel
        {
            Id = 1,
            LevelName = "Junior",
            AnnualLeaveDays = 12,
            SickLeaveDays = 14,
            OvertimeEligible = true,
            WorkingHoursPerDay = 8,
            BreakHoursPerShift = 1,
            PublicHolidayEligible = true,
            IsShift = true,
            ShiftType = "Morning Shift",
            Active = true,
        });

        await UpsertLevelAsync(db, 2, new EmployeeLevel
        {
            Id = 2,
            LevelName = "Management",
            AnnualLeaveDays = 20,
            SickLeaveDays = 18,
            OvertimeEligible = true,
            WorkingHoursPerDay = 8,
            BreakHoursPerShift = 1,
            PublicHolidayEligible = true,
            IsShift = true,
            ShiftType = "Flexible Shift",
            Active = true,
        });

        await UpsertLevelAsync(db, 3, new EmployeeLevel
        {
            Id = 3,
            LevelName = "Director",
            AnnualLeaveDays = 28,
            SickLeaveDays = 30,
            OvertimeEligible = false,
            WorkingHoursPerDay = 8,
            BreakHoursPerShift = 1,
            PublicHolidayEligible = false,
            IsShift = false,
            ShiftType = null,
            Active = true,
        });
    }

    static async Task UpsertLevelAsync(BisyncDbContext db, int id, EmployeeLevel template)
    {
        var level = await db.EmployeeLevels.FindAsync(id);
        if (level is null)
        {
            db.EmployeeLevels.Add(template);
            return;
        }

        level.LevelName = template.LevelName;
        level.AnnualLeaveDays = template.AnnualLeaveDays;
        level.SickLeaveDays = template.SickLeaveDays;
        level.OvertimeEligible = template.OvertimeEligible;
        level.WorkingHoursPerDay = template.WorkingHoursPerDay;
        level.BreakHoursPerShift = template.BreakHoursPerShift;
        level.PublicHolidayEligible = template.PublicHolidayEligible;
        level.IsShift = template.IsShift;
        level.ShiftType = template.ShiftType;
        level.Active = true;
    }

    static async Task RemoveExtraLevelsAsync(BisyncDbContext db)
    {
        var extras = await db.EmployeeLevels
            .Where(l => l.Id > 3 || !AllowedNames.Contains(l.LevelName))
            .ToListAsync();

        foreach (var level in extras)
        {
            await db.Employees
                .Where(e => e.EmployeeLevelId == level.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.EmployeeLevelId, 1));

            db.EmployeeLevels.Remove(level);
        }
    }
}
