using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/payroll-runs")]
public class PayrollRunsController(BisyncDbContext db, PayrollCalculationService calculator) : ControllerBase
{
    [HttpGet("preview")]
    public async Task<ActionResult<PayrollPreviewResult>> Preview(
        [FromQuery] int companyId,
        [FromQuery] int year,
        [FromQuery] int month)
    {
        if (month is < 1 or > 12) return BadRequest("Month must be between 1 and 12.");
        var preview = await calculator.BuildPreviewAsync(companyId, year, month);
        if (preview is null) return NotFound($"Company {companyId} not found.");
        return preview;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PayrollRunSummary>>> List(
        [FromQuery] int? companyId,
        [FromQuery] int? year)
    {
        var query = db.PayrollRuns.AsNoTracking().Include(r => r.Company).AsQueryable();
        if (companyId is not null) query = query.Where(r => r.CompanyId == companyId);
        if (year is not null) query = query.Where(r => r.Year == year);

        var runs = await query
            .OrderByDescending(r => r.Year)
            .ThenByDescending(r => r.Month)
            .ThenByDescending(r => r.ProcessedAt)
            .Select(r => new PayrollRunSummary
            {
                Id = r.Id,
                CompanyId = r.CompanyId,
                CompanyName = r.Company != null ? r.Company.Name : "—",
                Year = r.Year,
                Month = r.Month,
                PayCycle = r.PayCycle,
                PayType = r.PayType,
                CountryCode = r.CountryCode,
                PeriodLabel = r.PeriodLabel,
                PeriodStart = r.PeriodStart,
                PeriodEnd = r.PeriodEnd,
                ProcessedAt = r.ProcessedAt,
                TotalGross = r.TotalGross,
                TotalPayout = r.TotalPayout,
                EmployeeCount = r.EmployeeCount,
            })
            .ToListAsync();

        return runs;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PayrollRunDetail>> GetById(int id)
    {
        var run = await db.PayrollRuns.AsNoTracking()
            .Include(r => r.Company)
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (run is null) return NotFound();
        return ToDetail(run);
    }

    [HttpPost("process")]
    public async Task<ActionResult<PayrollRunDetail>> Process(PayrollProcessRequest request)
    {
        if (request.Month is < 1 or > 12) return BadRequest("Month must be between 1 and 12.");

        var exists = await db.PayrollRuns.AnyAsync(r =>
            r.CompanyId == request.CompanyId && r.Year == request.Year && r.Month == request.Month);
        if (exists)
            return Conflict($"Payroll for {request.Month}/{request.Year} has already been processed for this company.");

        var preview = await calculator.BuildPreviewAsync(request.CompanyId, request.Year, request.Month);
        if (preview is null) return NotFound($"Company {request.CompanyId} not found.");
        if (preview.Lines.Count == 0) return BadRequest("No active employees found for this company.");

        var run = new PayrollRun
        {
            CompanyId = preview.CompanyId,
            Year = preview.Year,
            Month = preview.Month,
            PayCycle = preview.PayCycle,
            PayType = preview.PayType,
            CountryCode = preview.CountryCode,
            PeriodLabel = preview.PeriodLabel,
            PeriodStart = DateOnly.Parse(preview.PeriodStart),
            PeriodEnd = DateOnly.Parse(preview.PeriodEnd),
            ProcessedAt = DateTime.UtcNow,
            TotalGross = preview.TotalGross,
            TotalPayout = preview.TotalPayout,
            EmployeeCount = preview.EmployeeCount,
            Lines = preview.Lines.Select(MapLine).ToList(),
        };

        db.PayrollRuns.Add(run);
        await db.SaveChangesAsync();

        var saved = await db.PayrollRuns.AsNoTracking()
            .Include(r => r.Company)
            .Include(r => r.Lines)
            .FirstAsync(r => r.Id == run.Id);

        return CreatedAtAction(nameof(GetById), new { id = run.Id }, ToDetail(saved));
    }

    static PayrollRunLine MapLine(PayrollLineResult line) => new()
    {
        EmployeeId = line.EmployeeId,
        EmployeeCode = line.EmployeeCode,
        EmployeeName = line.EmployeeName,
        Department = line.Department,
        Position = line.Position,
        PresentDays = line.PresentDays,
        WorkingDays = line.WorkingDays,
        TotalHours = line.TotalHours,
        OvertimeHours = line.OvertimeHours,
        AttendanceRatio = line.AttendanceRatio,
        BaseSalary = line.BaseSalary,
        ServiceAllowance = line.ServiceAllowance,
        AccommodationAllowance = line.AccommodationAllowance,
        TransportAllowance = line.TransportAllowance,
        MobileAllowance = line.MobileAllowance,
        BonusAmount = line.BonusAmount,
        OvertimeAmount = line.OvertimeAmount,
        EpfEmployeeAmount = line.EpfEmployeeAmount,
        EpfEmployerAmount = line.EpfEmployerAmount,
        SocsoEmployeeAmount = line.SocsoEmployeeAmount,
        SocsoEmployerAmount = line.SocsoEmployerAmount,
        IncomeTaxAmount = line.IncomeTaxAmount,
        GrossPay = line.GrossPay,
        TotalPayout = line.TotalPayout,
    };

    static PayrollRunDetail ToDetail(PayrollRun run) => new()
    {
        Id = run.Id,
        CompanyId = run.CompanyId,
        CompanyName = run.Company?.Name ?? "—",
        Year = run.Year,
        Month = run.Month,
        PayCycle = run.PayCycle,
        PayType = run.PayType,
        CountryCode = run.CountryCode,
        PeriodLabel = run.PeriodLabel,
        PeriodStart = run.PeriodStart,
        PeriodEnd = run.PeriodEnd,
        ProcessedAt = run.ProcessedAt,
        TotalGross = run.TotalGross,
        TotalPayout = run.TotalPayout,
        EmployeeCount = run.EmployeeCount,
        Lines = run.Lines.OrderBy(l => l.EmployeeName).Select(l => new PayrollRunLineItem
        {
            Id = l.Id,
            EmployeeId = l.EmployeeId,
            EmployeeCode = l.EmployeeCode,
            EmployeeName = l.EmployeeName,
            Department = l.Department,
            Position = l.Position,
            PresentDays = l.PresentDays,
            WorkingDays = l.WorkingDays,
            TotalHours = l.TotalHours,
            OvertimeHours = l.OvertimeHours,
            AttendanceRatio = l.AttendanceRatio,
            BaseSalary = l.BaseSalary,
            ServiceAllowance = l.ServiceAllowance,
            AccommodationAllowance = l.AccommodationAllowance,
            TransportAllowance = l.TransportAllowance,
            MobileAllowance = l.MobileAllowance,
            BonusAmount = l.BonusAmount,
            OvertimeAmount = l.OvertimeAmount,
            EpfEmployeeAmount = l.EpfEmployeeAmount,
            EpfEmployerAmount = l.EpfEmployerAmount,
            SocsoEmployeeAmount = l.SocsoEmployeeAmount,
            SocsoEmployerAmount = l.SocsoEmployerAmount,
            IncomeTaxAmount = l.IncomeTaxAmount,
            GrossPay = l.GrossPay,
            TotalPayout = l.TotalPayout,
        }).ToList(),
    };
}
