using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/public-holidays")]
public class PublicHolidaysController(BisyncDbContext db, PublicHolidaySyncService sync) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<PublicHoliday>> GetAll([FromQuery] bool? recognized, [FromQuery] string? countryCode)
    {
        if (!string.IsNullOrWhiteSpace(countryCode))
        {
            var code = countryCode.Trim().ToUpperInvariant();
            if (!await db.PublicHolidays.AsNoTracking().AnyAsync(h => h.CountryCode == code))
                await sync.SyncOperatingCountryAsync(db, code, recognitionByDate: null);
        }

        var query = db.PublicHolidays.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(countryCode))
        {
            var code = countryCode.Trim().ToUpperInvariant();
            query = query.Where(h => h.CountryCode == code);
        }
        if (recognized is not null) query = query.Where(h => h.IsRecognized == recognized);
        return await query.OrderBy(h => h.Date).ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<PublicHoliday>> Create(PublicHolidayRequest request)
    {
        var countryCode = !string.IsNullOrWhiteSpace(request.CountryCode)
            ? request.CountryCode.Trim().ToUpperInvariant()
            : await GetOperatingCountryCodeAsync();
        if (string.IsNullOrWhiteSpace(countryCode))
            return BadRequest("Country code is required.");

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest("Holiday name is required.");

        var holiday = new PublicHoliday
        {
            Name = name,
            Date = request.Date,
            IsRecognized = request.IsRecognized,
            IsRecurringAnnually = request.IsRecurringAnnually,
            IsGazetted = request.IsGazetted,
            CountryCode = countryCode,
            CatalogKey = PublicHolidayCatalogService.BuildCustomCatalogKey(countryCode, request.Date, name),
        };
        db.PublicHolidays.Add(holiday);
        await db.SaveChangesAsync();
        return holiday;
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PublicHoliday>> Update(int id, PublicHolidayRequest request)
    {
        var holiday = await db.PublicHolidays.FindAsync(id);
        if (holiday is null) return NotFound();
        holiday.Name = request.Name.Trim();
        holiday.Date = request.Date;
        holiday.IsRecognized = request.IsRecognized;
        holiday.IsRecurringAnnually = request.IsRecurringAnnually;
        holiday.IsGazetted = request.IsGazetted;
        if (PublicHolidayCatalogService.IsCustomCatalogKey(holiday.CatalogKey) && holiday.CountryCode is not null)
            holiday.CatalogKey = PublicHolidayCatalogService.BuildCustomCatalogKey(holiday.CountryCode, request.Date, holiday.Name);
        else if (holiday.CountryCode is not null)
            holiday.CatalogKey = PublicHolidayCatalogService.BuildCatalogKey(holiday.CountryCode, request.Date, holiday.Name);
        await db.SaveChangesAsync();
        return holiday;
    }

    [HttpPost("{id:int}/toggle-recognized")]
    public async Task<ActionResult<PublicHoliday>> ToggleRecognized(int id)
    {
        var holiday = await db.PublicHolidays.FindAsync(id);
        if (holiday is null) return NotFound();
        holiday.IsRecognized = !holiday.IsRecognized;
        await db.SaveChangesAsync();
        return holiday;
    }

    [HttpPost("{id:int}/toggle-gazetted")]
    public async Task<ActionResult<PublicHoliday>> ToggleGazetted(int id)
    {
        var holiday = await db.PublicHolidays.FindAsync(id);
        if (holiday is null) return NotFound();
        holiday.IsGazetted = !holiday.IsGazetted;
        await db.SaveChangesAsync();
        return holiday;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var holiday = await db.PublicHolidays.FindAsync(id);
        if (holiday is null) return NotFound();
        db.PublicHolidays.Remove(holiday);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> GetOperatingCountryCodeAsync() =>
        (await db.CompanySettings.AsNoTracking().FirstOrDefaultAsync())?.OperatingCountryCode;
}

[ApiController]
[Route("api/employee-levels")]
public class EmployeeLevelsController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<EmployeeLevel>> GetAll() =>
        await db.EmployeeLevels.AsNoTracking().OrderBy(l => l.Id).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<EmployeeLevel>> Create(EmployeeLevelRequest request)
    {
        if (await db.EmployeeLevels.AnyAsync(l => l.LevelName == request.LevelName))
            return Conflict($"Level '{request.LevelName}' already exists.");
        var level = new EmployeeLevel();
        Apply(level, request);
        db.EmployeeLevels.Add(level);
        await db.SaveChangesAsync();
        return level;
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<EmployeeLevel>> Update(int id, EmployeeLevelRequest request)
    {
        var level = await db.EmployeeLevels.FindAsync(id);
        if (level is null) return NotFound();
        if (await db.EmployeeLevels.AnyAsync(l => l.LevelName == request.LevelName && l.Id != id))
            return Conflict($"Level '{request.LevelName}' already exists.");
        Apply(level, request);
        await db.SaveChangesAsync();
        await SyncEmployeesToLevel(level);
        return level;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var level = await db.EmployeeLevels.FindAsync(id);
        if (level is null) return NotFound();
        db.EmployeeLevels.Remove(level);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(EmployeeLevel level, EmployeeLevelRequest request)
    {
        level.LevelName = request.LevelName;
        level.AnnualLeaveDays = request.AnnualLeaveDays;
        level.SickLeaveDays = request.SickLeaveDays;
        level.OvertimeEligible = request.OvertimeEligible;
        level.WorkingHoursPerDay = request.WorkingHoursPerDay;
        level.BreakHoursPerShift = request.BreakHoursPerShift;
        level.PublicHolidayEligible = request.PublicHolidayEligible;
        level.IsShift = request.IsShift;
        level.ShiftType = null;
        level.Active = request.Active;
    }

    private async Task SyncEmployeesToLevel(EmployeeLevel level)
    {
        var employees = await db.Employees.Where(e => e.EmployeeLevelId == level.Id).ToListAsync();
        foreach (var employee in employees)
            EmployeeShiftSync.ApplyFromLevel(employee, level);
        if (employees.Count > 0)
            await db.SaveChangesAsync();
    }
}

[ApiController]
[Route("api/settings")]
public class SettingsController(
    BisyncDbContext db,
    PublicHolidayCatalogService catalog,
    PublicHolidaySyncService sync) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CompanySetting>> Get()
    {
        var setting = await db.CompanySettings.AsNoTracking().FirstOrDefaultAsync();
        return setting is null ? NotFound() : setting;
    }

    [HttpGet("countries")]
    public async Task<ActionResult<IEnumerable<CountryOption>>> GetCountries() =>
        Ok(await catalog.GetAvailableCountriesAsync());

    [HttpPut]
    public async Task<ActionResult<CompanySetting>> Update(PayMultiplierRequest request)
    {
        var setting = await db.CompanySettings.FirstOrDefaultAsync();
        if (setting is null)
        {
            setting = new CompanySetting();
            db.CompanySettings.Add(setting);
        }

        var previousCountry = setting.OperatingCountryCode;
        IReadOnlyDictionary<DateOnly, bool>? recognitionByDate = null;

        if (request.PublicHolidayPayMultiplier is { } multiplier)
            setting.PublicHolidayPayMultiplier = multiplier;

        if (request.ReplacementPublicHolidayEnabled is { } replacementEnabled)
            setting.ReplacementPublicHolidayEnabled = replacementEnabled;

        if (request.GazettedPhReplacementDayEnabled is { } gazettedReplacement)
            setting.GazettedPhReplacementDayEnabled = gazettedReplacement;

        if (request.GazettedPhNormalHoursRate is { } normalRate)
        {
            setting.GazettedPhNormalHoursRate = normalRate;
            setting.PublicHolidayPayMultiplier = normalRate;
        }

        if (request.GazettedPhOvertimeHoursRate is { } overtimeRate)
            setting.GazettedPhOvertimeHoursRate = overtimeRate;

        if (request.NonGazettedPhReplacementDayEnabled is { } nonGazettedReplacement)
            setting.NonGazettedPhReplacementDayEnabled = nonGazettedReplacement;

        var countryChanged = false;
        if (!string.IsNullOrWhiteSpace(request.OperatingCountryCode))
        {
            var countryCode = request.OperatingCountryCode.Trim().ToUpperInvariant();
            countryChanged = !string.Equals(previousCountry, countryCode, StringComparison.OrdinalIgnoreCase);
            if (countryChanged)
            {
                recognitionByDate = await db.PublicHolidays
                    .AsNoTracking()
                    .GroupBy(h => h.Date)
                    .ToDictionaryAsync(g => g.Key, g => g.First().IsRecognized);
            }
            setting.OperatingCountryCode = countryCode;
        }

        await db.SaveChangesAsync();

        if (countryChanged)
            await sync.SyncOperatingCountryAsync(db, setting.OperatingCountryCode, recognitionByDate);

        return setting;
    }
}

[ApiController]
[Route("api/divisions")]
public class DivisionsController(BisyncDbContext db) : ControllerBase
{
    [HttpGet("tree")]
    public async Task<ActionResult<IEnumerable<DivisionTreeNode>>> GetTree()
    {
        var divisions = await db.Divisions
            .AsNoTracking()
            .Include(d => d.Departments)
            .OrderBy(d => d.Name)
            .ToListAsync();

        return divisions.Select(d => new DivisionTreeNode
        {
            Id = d.Id,
            Name = d.Name,
            Code = d.Code,
            Departments = d.Departments
                .OrderBy(dep => dep.Name)
                .Select(dep => new DepartmentNode
                {
                    Id = dep.Id,
                    Name = dep.Name,
                    DivisionId = dep.DivisionId,
                })
                .ToList(),
        }).ToList();
    }

    [HttpGet]
    public async Task<IEnumerable<Division>> GetAll() =>
        await db.Divisions.AsNoTracking().OrderBy(d => d.Name).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Division>> Create(DivisionRequest request)
    {
        var name = request.Name.Trim();
        if (await db.Divisions.AnyAsync(d => d.Name == name))
            return Conflict($"Division '{name}' already exists.");

        var division = new Division { Name = name, Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim() };
        db.Divisions.Add(division);
        await db.SaveChangesAsync();
        return division;
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Division>> Update(int id, DivisionRequest request)
    {
        var division = await db.Divisions.FindAsync(id);
        if (division is null) return NotFound();

        var name = request.Name.Trim();
        if (await db.Divisions.AnyAsync(d => d.Name == name && d.Id != id))
            return Conflict($"Division '{name}' already exists.");

        division.Name = name;
        division.Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim();
        await db.SaveChangesAsync();
        return division;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var division = await db.Divisions.FindAsync(id);
        if (division is null) return NotFound();
        db.Divisions.Remove(division);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

[ApiController]
[Route("api/departments")]
public class DepartmentsController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<Department>> GetAll() =>
        await db.Departments.AsNoTracking().OrderBy(d => d.Name).ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Department>> Create(DepartmentRequest request)
    {
        var division = await db.Divisions.FindAsync(request.DivisionId);
        if (division is null) return BadRequest($"Division {request.DivisionId} not found.");

        var name = request.Name.Trim();
        if (await db.Departments.AnyAsync(d => d.DivisionId == request.DivisionId && d.Name == name))
            return Conflict($"Department '{name}' already exists in this division.");

        var department = new Department { Name = name, DivisionId = request.DivisionId };
        db.Departments.Add(department);
        await db.SaveChangesAsync();
        return department;
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Department>> Update(int id, DepartmentRequest request)
    {
        var department = await db.Departments.FindAsync(id);
        if (department is null) return NotFound();

        var division = await db.Divisions.FindAsync(request.DivisionId);
        if (division is null) return BadRequest($"Division {request.DivisionId} not found.");

        var name = request.Name.Trim();
        if (await db.Departments.AnyAsync(d => d.DivisionId == request.DivisionId && d.Name == name && d.Id != id))
            return Conflict($"Department '{name}' already exists in this division.");

        department.Name = name;
        department.DivisionId = request.DivisionId;
        await db.SaveChangesAsync();
        return department;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var department = await db.Departments.FindAsync(id);
        if (department is null) return NotFound();
        db.Departments.Remove(department);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
