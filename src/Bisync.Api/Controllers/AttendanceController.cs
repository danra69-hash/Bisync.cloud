using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/attendance")]
public class AttendanceController(BisyncDbContext db, ReplacementPublicHolidayService rphService) : ControllerBase
{
    /// <summary>Records for the attendance grid; filter by date range and/or employee.</summary>
    [HttpGet]
    public async Task<IEnumerable<AttendanceRecord>> GetAll(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int? employeeId)
    {
        var query = db.AttendanceRecords.AsNoTracking().AsQueryable();
        if (from is not null) query = query.Where(a => a.Date >= from);
        if (to is not null) query = query.Where(a => a.Date <= to);
        if (employeeId is not null) query = query.Where(a => a.EmployeeId == employeeId);
        return await query.OrderBy(a => a.Date).ThenBy(a => a.EmployeeId).ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<AttendanceRecord>> Create(AttendanceRecordRequest request)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == request.EmployeeId))
            return BadRequest($"Employee {request.EmployeeId} does not exist.");
        if (await db.AttendanceRecords.AnyAsync(a => a.EmployeeId == request.EmployeeId && a.Date == request.Date))
            return Conflict("An attendance record already exists for this employee and date.");

        var record = new AttendanceRecord();
        Apply(record, request);
        db.AttendanceRecords.Add(record);
        await rphService.SyncAccrualAsync(record);
        await db.SaveChangesAsync();
        return record;
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AttendanceRecord>> Update(int id, AttendanceRecordRequest request)
    {
        var record = await db.AttendanceRecords.FindAsync(id);
        if (record is null) return NotFound();
        Apply(record, request);
        await rphService.SyncAccrualAsync(record);
        await db.SaveChangesAsync();
        return record;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var record = await db.AttendanceRecords.FindAsync(id);
        if (record is null) return NotFound();
        await rphService.ReverseAccrualAsync(record);
        db.AttendanceRecords.Remove(record);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Per-employee summary backing the attendance detail modal.</summary>
    [HttpGet("summary/{employeeId:int}")]
    public async Task<ActionResult<object>> Summary(int employeeId, [FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == employeeId)) return NotFound();

        var query = db.AttendanceRecords.AsNoTracking().Where(a => a.EmployeeId == employeeId);
        if (from is not null) query = query.Where(a => a.Date >= from);
        if (to is not null) query = query.Where(a => a.Date <= to);
        var records = await query.ToListAsync();

        double totalHours = 0, totalOvertime = 0;
        int lateDays = 0;
        foreach (var r in records)
        {
            if (r.ScheduledIn is not null && r.ActualIn is not null && r.ActualIn > r.ScheduledIn) lateDays++;
            if (r is { ScheduledIn: not null, ScheduledOut: not null, ActualIn: not null, ActualOut: not null })
            {
                var scheduled = (r.ScheduledOut.Value - r.ScheduledIn.Value).TotalHours;
                var actual = (r.ActualOut.Value - r.ActualIn.Value).TotalHours;
                totalHours += actual;
                totalOvertime += Math.Max(0, actual - scheduled);
            }
        }

        var presentDays = records.Count(r => r.Status is AttendanceStatus.Present or AttendanceStatus.Late);
        return new
        {
            EmployeeId = employeeId,
            TotalDays = records.Count,
            PresentDays = presentDays,
            AbsentDays = records.Count(r => r.Status == AttendanceStatus.Absent),
            LateDays = lateDays,
            TotalHours = Math.Round(totalHours, 2),
            OvertimeHours = Math.Round(totalOvertime, 2),
            AverageHoursPerDay = presentDays > 0 ? Math.Round(totalHours / presentDays, 2) : 0
        };
    }

    private static void Apply(AttendanceRecord record, AttendanceRecordRequest request)
    {
        record.EmployeeId = request.EmployeeId;
        record.Date = request.Date;
        record.Status = request.Status;
        record.ScheduledIn = request.ScheduledIn;
        record.ScheduledOut = request.ScheduledOut;
        record.ActualIn = request.ActualIn;
        record.ActualOut = request.ActualOut;
    }
}
