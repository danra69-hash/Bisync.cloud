using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/income-tax")]
public class IncomeTaxController(BisyncDbContext db, IncomeTaxService incomeTaxService) : ControllerBase
{
    [HttpGet("{companyId:int}/{year:int}")]
    public async Task<ActionResult<IncomeTaxYearDetail>> Get(int companyId, int year)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);
        if (company is null) return NotFound();

        var schedule = await incomeTaxService.GetOrCreateScheduleAsync(companyId, year);
        return ToDetail(schedule, company.Name);
    }

    [HttpPut("{companyId:int}/{year:int}")]
    public async Task<ActionResult<IncomeTaxYearDetail>> Save(int companyId, int year, IncomeTaxYearRequest request)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == companyId);
        if (company is null) return NotFound();

        var validation = ValidateRequest(request);
        if (validation is not null) return BadRequest(validation);

        var schedule = await db.IncomeTaxYears
            .Include(s => s.Brackets)
            .Include(s => s.Reliefs)
            .Include(s => s.Rebates)
            .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.Year == year);

        if (schedule is null)
        {
            schedule = new IncomeTaxYear { CompanyId = companyId, Year = year };
            db.IncomeTaxYears.Add(schedule);
        }

        var payStructure = await db.PayStructures.AsNoTracking()
            .FirstOrDefaultAsync(p => p.CompanyId == companyId);
        schedule.CountryCode = payStructure?.CountryCode ?? company.CountryCode;
        schedule.Active = request.Active;

        db.IncomeTaxBrackets.RemoveRange(schedule.Brackets);
        schedule.Brackets = request.Brackets
            .Select((b, index) => new IncomeTaxBracket
            {
                SortOrder = index,
                MinAnnualChargeableIncome = b.MinAnnualChargeableIncome,
                MaxAnnualChargeableIncome = b.MaxAnnualChargeableIncome,
                RatePct = b.RatePct,
                BaseMinTaxAmount = b.BaseMinTaxAmount,
            })
            .ToList();

        db.IncomeTaxReliefs.RemoveRange(schedule.Reliefs);
        schedule.Reliefs = request.Reliefs
            .Select((r, index) => new IncomeTaxRelief
            {
                SortOrder = index,
                Name = r.Name.Trim(),
                Amount = r.Amount,
                IsMaximum = r.IsMaximum,
                ApplyCondition = string.IsNullOrWhiteSpace(r.ApplyCondition) ? null : r.ApplyCondition.Trim(),
            })
            .ToList();

        db.IncomeTaxRebates.RemoveRange(schedule.Rebates);
        schedule.Rebates = request.Rebates
            .Select((r, index) => new IncomeTaxRebate
            {
                SortOrder = index,
                Name = r.Name.Trim(),
                Amount = r.Amount,
            })
            .ToList();

        await db.SaveChangesAsync();
        return ToDetail(schedule, company.Name);
    }

    [HttpGet("{companyId:int}/{year:int}/preview")]
    public async Task<ActionResult<IncomeTaxYearPreviewDetail>> Preview(int companyId, int year)
    {
        var preview = await incomeTaxService.BuildYearlyPreviewAsync(companyId, year);
        if (preview is null) return NotFound();
        return ToPreviewDetail(preview);
    }

    static string? ValidateRequest(IncomeTaxYearRequest request)
    {
        var bracketValidation = ValidateBrackets(request.Brackets);
        if (bracketValidation is not null) return bracketValidation;

        foreach (var relief in request.Reliefs)
        {
            if (string.IsNullOrWhiteSpace(relief.Name))
                return "Each tax relief must have a name.";
        }

        foreach (var rebate in request.Rebates)
        {
            if (string.IsNullOrWhiteSpace(rebate.Name))
                return "Each tax rebate must have a name.";
        }

        return null;
    }

    static string? ValidateBrackets(List<IncomeTaxBracketItem> brackets)
    {
        if (brackets.Count == 0) return "At least one progressive tax bracket is required.";

        var ordered = brackets
            .Select((b, index) => (b, index))
            .OrderBy(x => x.b.MinAnnualChargeableIncome)
            .ThenBy(x => x.index)
            .ToList();

        for (var i = 0; i < ordered.Count; i++)
        {
            var bracket = ordered[i].b;
            if (bracket.RatePct < 0 || bracket.RatePct > 100)
                return "Tax rate must be between 0 and 100 percent.";
            if (bracket.BaseMinTaxAmount < 0)
                return "Base tax amount cannot be negative.";
            if (bracket.MaxAnnualChargeableIncome is not null
                && bracket.MaxAnnualChargeableIncome.Value <= bracket.MinAnnualChargeableIncome)
                return "Each bracket max chargeable income must be greater than its min.";
            if (i > 0)
            {
                var prev = ordered[i - 1].b;
                if (bracket.MinAnnualChargeableIncome < prev.MinAnnualChargeableIncome)
                    return "Brackets must be ordered by increasing chargeable income.";
            }
        }

        return null;
    }

    static IncomeTaxYearDetail ToDetail(IncomeTaxYear schedule, string companyName) => new()
    {
        Id = schedule.Id,
        CompanyId = schedule.CompanyId,
        CompanyName = companyName,
        Year = schedule.Year,
        CountryCode = schedule.CountryCode,
        Active = schedule.Active,
        Brackets = schedule.Brackets
            .OrderBy(b => b.SortOrder)
            .ThenBy(b => b.Id)
            .Select(b => new IncomeTaxBracketItem
            {
                Id = b.Id,
                MinAnnualChargeableIncome = b.MinAnnualChargeableIncome,
                MaxAnnualChargeableIncome = b.MaxAnnualChargeableIncome,
                RatePct = b.RatePct,
                BaseMinTaxAmount = b.BaseMinTaxAmount,
            })
            .ToList(),
        Reliefs = schedule.Reliefs
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Id)
            .Select(r => new IncomeTaxReliefItem
            {
                Id = r.Id,
                Name = r.Name,
                Amount = r.Amount,
                IsMaximum = r.IsMaximum,
                ApplyCondition = r.ApplyCondition,
            })
            .ToList(),
        Rebates = schedule.Rebates
            .OrderBy(r => r.SortOrder)
            .ThenBy(r => r.Id)
            .Select(r => new IncomeTaxRebateItem
            {
                Id = r.Id,
                Name = r.Name,
                Amount = r.Amount,
            })
            .ToList(),
    };

    static IncomeTaxYearPreviewDetail ToPreviewDetail(IncomeTaxYearPreview preview) => new()
    {
        CompanyId = preview.CompanyId,
        CompanyName = preview.CompanyName,
        Year = preview.Year,
        CountryCode = preview.CountryCode,
        Configured = preview.Configured,
        TotalAnnualGross = preview.TotalAnnualGross,
        TotalAnnualTax = preview.TotalAnnualTax,
        TotalMonthlyPcb = preview.TotalMonthlyPcb,
        EmployeeCount = preview.EmployeeCount,
        Lines = preview.Lines.Select(l => new IncomeTaxEmployeeLineItem
        {
            EmployeeId = l.EmployeeId,
            EmployeeCode = l.EmployeeCode,
            EmployeeName = l.EmployeeName,
            Position = l.Position,
            AnnualGross = l.AnnualGross,
            AnnualEpfEmployee = l.AnnualEpfEmployee,
            AnnualTaxRelief = l.AnnualTaxRelief,
            BaseTaxAmount = l.BaseTaxAmount,
            AnnualRebate = l.AnnualRebate,
            AnnualTax = l.AnnualTax,
            MonthlyPcb = l.MonthlyPcb,
        }).ToList(),
    };
}
