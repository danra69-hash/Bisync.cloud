using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pay-structures")]
public class PayStructuresController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PayStructureDetail>>> GetAll()
    {
        var structures = await db.PayStructures
            .AsNoTracking()
            .Include(p => p.MandatoryContributions)
            .Include(p => p.ProvidentFundBrackets)
            .Include(p => p.SocsoBrackets)
            .Include(p => p.Company)
            .OrderBy(p => p.Company!.Name)
            .ToListAsync();

        return structures.Select(ToDetail).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PayStructureDetail>> GetById(int id)
    {
        var structure = await LoadAsync(id);
        if (structure is null) return NotFound();
        return ToDetail(structure);
    }

    [HttpPost]
    public async Task<ActionResult<PayStructureDetail>> Create(PayStructureRequest request)
    {
        var validation = await ValidateAsync(request);
        if (validation is not null) return BadRequest(validation);

        var structure = new PayStructure();
        await ApplyAsync(structure, request, isNew: true);
        db.PayStructures.Add(structure);
        await db.SaveChangesAsync();

        var saved = await LoadAsync(structure.Id);
        return CreatedAtAction(nameof(GetById), new { id = structure.Id }, ToDetail(saved!));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PayStructureDetail>> Update(int id, PayStructureRequest request)
    {
        var structure = await db.PayStructures
            .Include(p => p.MandatoryContributions)
            .Include(p => p.ProvidentFundBrackets)
            .Include(p => p.SocsoBrackets)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (structure is null) return NotFound();

        var validation = await ValidateAsync(request, structure.Id);
        if (validation is not null) return BadRequest(validation);

        await ApplyAsync(structure, request, isNew: false);
        await db.SaveChangesAsync();

        var saved = await LoadAsync(structure.Id);
        return ToDetail(saved!);
    }

    async Task<PayStructure?> LoadAsync(int id) =>
        await db.PayStructures
            .AsNoTracking()
            .Include(p => p.MandatoryContributions)
            .Include(p => p.ProvidentFundBrackets)
            .Include(p => p.SocsoBrackets)
            .Include(p => p.Company)
            .FirstOrDefaultAsync(p => p.Id == id);

    async Task<string?> ValidateAsync(PayStructureRequest request, int? existingId = null)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == request.CompanyId);
        if (company is null) return $"Company {request.CompanyId} not found.";

        var duplicate = await db.PayStructures.AnyAsync(p =>
            p.CompanyId == request.CompanyId && (existingId == null || p.Id != existingId));
        if (duplicate) return "A pay structure already exists for this company.";

        if (company.CountryCode == "MY" && request.ProvidentFundBrackets.Count == 0)
            return "Malaysia pay structures require at least one provident fund bracket.";

        if (company.CountryCode == "MY" && request.SocsoBrackets.Count == 0)
            return "Malaysia pay structures require at least one SOCSO bracket.";

        if (string.Equals(request.OvertimeCalculationMode, OvertimeCalculationHelper.ModeFixed, StringComparison.OrdinalIgnoreCase)
            && (request.OvertimeFixedHourlyRate is null or <= 0))
            return "Enter a fixed overtime hourly rate when using fixed overtime calculation.";

        foreach (var bracket in request.ProvidentFundBrackets)
        {
            if (!bracket.NoContribution && bracket.EmployerPct < 0)
                return "Provident fund company contribution must be zero or greater.";
            if (!bracket.NoContribution && bracket.EmployeePct < 0)
                return "Provident fund employee contribution must be zero or greater.";
        }

        foreach (var contribution in request.MandatoryContributions)
        {
            if (string.IsNullOrWhiteSpace(contribution.Name))
                return "Each mandatory contribution must have a name.";
        }

        return null;
    }

    async Task ApplyAsync(PayStructure structure, PayStructureRequest request, bool isNew)
    {
        var company = await db.Companies.AsNoTracking().FirstAsync(c => c.Id == request.CompanyId);

        structure.CompanyId = request.CompanyId;
        structure.CountryCode = company.CountryCode;
        structure.PayType = request.PayType.Trim();
        structure.PayCycle = request.PayCycle.Trim();
        structure.Active = request.Active;
        structure.OvertimeRateMultiplier = request.OvertimeRateMultiplier > 0 ? request.OvertimeRateMultiplier : 1.5m;
        structure.OvertimeCalculationMode = string.Equals(request.OvertimeCalculationMode, OvertimeCalculationHelper.ModeFixed, StringComparison.OrdinalIgnoreCase)
            ? OvertimeCalculationHelper.ModeFixed
            : OvertimeCalculationHelper.ModeCalculated;
        structure.OvertimeFixedHourlyRate = structure.OvertimeCalculationMode == OvertimeCalculationHelper.ModeFixed
            ? request.OvertimeFixedHourlyRate
            : null;

        if (company.CountryCode == "MY" && request.ProvidentFundBrackets.Count > 0)
        {
            var firstContributing = request.ProvidentFundBrackets.FirstOrDefault(b => !b.NoContribution);
            structure.ProvidentFundEmployerPct = firstContributing?.EmployerPct ?? 0;
            structure.ProvidentFundEmployeePct = firstContributing?.EmployeePct ?? 0;
            structure.ForeignProvidentFundEmployerPct = request.ForeignProvidentFundEmployerPct;
            structure.ForeignProvidentFundEmployeePct = request.ForeignProvidentFundEmployeePct;
            structure.ForeignSocsoEmployerPct = request.ForeignSocsoEmployerPct;
        }
        else
        {
            structure.ProvidentFundEmployerPct = request.ProvidentFundEmployerPct;
            structure.ProvidentFundEmployeePct = request.ProvidentFundEmployeePct;
            structure.ForeignProvidentFundEmployerPct = 0;
            structure.ForeignProvidentFundEmployeePct = 0;
            structure.ForeignSocsoEmployerPct = 0;
        }

        if (!isNew)
        {
            db.MandatoryContributions.RemoveRange(structure.MandatoryContributions);
            db.ProvidentFundBrackets.RemoveRange(structure.ProvidentFundBrackets);
            db.SocsoBrackets.RemoveRange(structure.SocsoBrackets);
        }

        structure.MandatoryContributions = request.MandatoryContributions
            .Select(c => new MandatoryContribution
            {
                Name = c.Name.Trim(),
                EmployerPct = c.EmployerPct,
                EmployeePct = c.EmployeePct,
            })
            .ToList();

        structure.ProvidentFundBrackets = request.ProvidentFundBrackets
            .Select((b, index) => new ProvidentFundBracket
            {
                SortOrder = index,
                MinAge = b.MinAge,
                MaxAge = b.MaxAge,
                MinMonthlySalary = b.MinMonthlySalary,
                MaxMonthlySalary = b.MaxMonthlySalary,
                EmployerPct = b.NoContribution ? 0 : b.EmployerPct,
                EmployeePct = b.NoContribution ? 0 : b.EmployeePct,
                NoContribution = b.NoContribution,
            })
            .ToList();

        structure.SocsoBrackets = request.SocsoBrackets
            .Select((b, index) => new SocsoBracket
            {
                SortOrder = index,
                MinAge = b.MinAge,
                MaxAge = b.MaxAge,
                MinMonthlySalary = b.MinMonthlySalary,
                MaxMonthlySalary = b.MaxMonthlySalary,
                EmployerAmount = b.EmployerAmount,
                EmployeeAmount = b.EmployeeAmount,
            })
            .ToList();
    }

    static PayStructureDetail ToDetail(PayStructure structure) => new()
    {
        Id = structure.Id,
        CompanyId = structure.CompanyId,
        CompanyName = structure.Company?.Name ?? "—",
        CountryCode = structure.CountryCode,
        PayType = structure.PayType,
        PayCycle = structure.PayCycle,
        ProvidentFundEmployerPct = structure.ProvidentFundEmployerPct,
        ProvidentFundEmployeePct = structure.ProvidentFundEmployeePct,
        ForeignProvidentFundEmployerPct = structure.ForeignProvidentFundEmployerPct,
        ForeignProvidentFundEmployeePct = structure.ForeignProvidentFundEmployeePct,
        ForeignSocsoEmployerPct = structure.ForeignSocsoEmployerPct,
        OvertimeRateMultiplier = structure.OvertimeRateMultiplier,
        OvertimeCalculationMode = structure.OvertimeCalculationMode,
        OvertimeFixedHourlyRate = structure.OvertimeFixedHourlyRate,
        Active = structure.Active,
        ProvidentFundBrackets = structure.ProvidentFundBrackets
            .OrderBy(b => b.SortOrder)
            .ThenBy(b => b.Id)
            .Select(b => new ProvidentFundBracketItem
            {
                Id = b.Id,
                MinAge = b.MinAge,
                MaxAge = b.MaxAge,
                MinMonthlySalary = b.MinMonthlySalary,
                MaxMonthlySalary = b.MaxMonthlySalary,
                EmployerPct = b.EmployerPct,
                EmployeePct = b.EmployeePct,
                NoContribution = b.NoContribution,
            })
            .ToList(),
        SocsoBrackets = structure.SocsoBrackets
            .OrderBy(b => b.SortOrder)
            .ThenBy(b => b.Id)
            .Select(b => new SocsoBracketItem
            {
                Id = b.Id,
                MinAge = b.MinAge,
                MaxAge = b.MaxAge,
                MinMonthlySalary = b.MinMonthlySalary,
                MaxMonthlySalary = b.MaxMonthlySalary,
                EmployerAmount = b.EmployerAmount,
                EmployeeAmount = b.EmployeeAmount,
            })
            .ToList(),
        MandatoryContributions = structure.MandatoryContributions
            .OrderBy(c => c.Id)
            .Select(c => new MandatoryContributionItem
            {
                Id = c.Id,
                Name = c.Name,
                EmployerPct = c.EmployerPct,
                EmployeePct = c.EmployeePct,
            })
            .ToList(),
    };
}
