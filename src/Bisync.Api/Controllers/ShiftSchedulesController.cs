using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/shift-schedules")]
public class ShiftSchedulesController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<ShiftSchedule>> GetAll(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        [FromQuery] int? employeeId)
    {
        var query = db.ShiftSchedules.AsNoTracking().AsQueryable();
        if (from is not null) query = query.Where(s => s.Date >= from);
        if (to is not null) query = query.Where(s => s.Date <= to);
        if (employeeId is not null) query = query.Where(s => s.EmployeeId == employeeId);
        return await query.OrderBy(s => s.Date).ThenBy(s => s.EmployeeId).ToListAsync();
    }

    /// <summary>
    /// Creates or replaces the schedule entry for the employee/date cell.
    /// For Work entries the end time is computed from the employee's working hours,
    /// matching the schedule grid behavior in the design.
    /// </summary>
    [HttpPut]
    public async Task<ActionResult<ShiftSchedule>> Upsert(ShiftScheduleRequest request)
    {
        var employee = await db.Employees.FindAsync(request.EmployeeId);
        if (employee is null) return BadRequest($"Employee {request.EmployeeId} does not exist.");
        if (request.Type == ScheduleType.Work && request.StartTime is null)
            return BadRequest("A start time is required for a Work entry.");

        var schedule = await db.ShiftSchedules
            .FirstOrDefaultAsync(s => s.EmployeeId == request.EmployeeId && s.Date == request.Date);
        if (schedule is null)
        {
            schedule = new ShiftSchedule { EmployeeId = request.EmployeeId, Date = request.Date };
            db.ShiftSchedules.Add(schedule);
        }

        schedule.Type = request.Type;
        if (request.Type == ScheduleType.Work)
        {
            schedule.StartTime = request.StartTime;
            schedule.EndTime = request.StartTime!.Value.AddMinutes((double)(employee.WorkingHoursPerDay * 60));
        }
        else
        {
            schedule.StartTime = null;
            schedule.EndTime = null;
        }

        await db.SaveChangesAsync();
        return schedule;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var schedule = await db.ShiftSchedules.FindAsync(id);
        if (schedule is null) return NotFound();
        db.ShiftSchedules.Remove(schedule);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
