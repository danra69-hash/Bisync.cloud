using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/leave-requests")]
public class LeaveRequestsController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<LeaveRequest>> GetAll([FromQuery] LeaveStatus? status, [FromQuery] int? employeeId)
    {
        var query = db.LeaveRequests.AsNoTracking().AsQueryable();
        if (status is not null) query = query.Where(r => r.Status == status);
        if (employeeId is not null) query = query.Where(r => r.EmployeeId == employeeId);
        return await query.OrderByDescending(r => r.StartDate).ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<LeaveRequest>> Create(LeaveRequestCreate request)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == request.EmployeeId))
            return BadRequest($"Employee {request.EmployeeId} does not exist.");
        if (request.EndDate < request.StartDate)
            return BadRequest("End date must be on or after the start date.");

        var leave = new LeaveRequest
        {
            EmployeeId = request.EmployeeId,
            Type = request.Type,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Reason = request.Reason,
            Status = LeaveStatus.Pending
        };
        db.LeaveRequests.Add(leave);
        await db.SaveChangesAsync();
        return leave;
    }

    /// <summary>Approve a pending request and deduct the balance (except unpaid leave).</summary>
    [HttpPost("{id:int}/approve")]
    public async Task<ActionResult<LeaveRequest>> Approve(int id)
    {
        var leave = await db.LeaveRequests.FindAsync(id);
        if (leave is null) return NotFound();
        if (leave.Status != LeaveStatus.Pending) return Conflict("Only pending requests can be approved.");

        if (leave.Type != LeaveType.UPL)
        {
            var balance = await db.LeaveBalances.FindAsync(leave.EmployeeId);
            if (balance is not null)
            {
                var days = leave.EndDate.DayNumber - leave.StartDate.DayNumber + 1;
                switch (leave.Type)
                {
                    case LeaveType.RDO:
                        balance.RdoBalance = Math.Max(0, balance.RdoBalance - days);
                        break;
                    case LeaveType.RPH:
                        balance.RphBalance = Math.Max(0, balance.RphBalance - days);
                        break;
                    case LeaveType.AL:
                        balance.AlBalance = Math.Max(0, balance.AlBalance - days);
                        break;
                }
            }
        }

        leave.Status = LeaveStatus.Approved;
        await db.SaveChangesAsync();
        return leave;
    }

    [HttpPost("{id:int}/reject")]
    public async Task<ActionResult<LeaveRequest>> Reject(int id)
    {
        var leave = await db.LeaveRequests.FindAsync(id);
        if (leave is null) return NotFound();
        if (leave.Status != LeaveStatus.Pending) return Conflict("Only pending requests can be rejected.");

        leave.Status = LeaveStatus.Rejected;
        await db.SaveChangesAsync();
        return leave;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var leave = await db.LeaveRequests.FindAsync(id);
        if (leave is null) return NotFound();
        db.LeaveRequests.Remove(leave);
        await db.SaveChangesAsync();
        return NoContent();
    }
}

[ApiController]
[Route("api/leave-balances")]
public class LeaveBalancesController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<object>> GetAll()
    {
        return await db.LeaveBalances
            .AsNoTracking()
            .Select(b => new
            {
                b.EmployeeId,
                EmployeeName = b.Employee!.Name,
                b.RdoBalance,
                b.RphBalance,
                b.AlBalance
            })
            .OrderBy(b => b.EmployeeName)
            .ToListAsync();
    }

    [HttpGet("{employeeId:int}")]
    public async Task<ActionResult<LeaveBalance>> GetByEmployee(int employeeId)
    {
        var balance = await db.LeaveBalances.FindAsync(employeeId);
        return balance is null ? NotFound() : balance;
    }

    [HttpPut("{employeeId:int}")]
    public async Task<ActionResult<LeaveBalance>> Update(int employeeId, LeaveBalanceRequest request)
    {
        var balance = await db.LeaveBalances.FindAsync(employeeId);
        if (balance is null)
        {
            if (!await db.Employees.AnyAsync(e => e.Id == employeeId)) return NotFound();
            balance = new LeaveBalance { EmployeeId = employeeId };
            db.LeaveBalances.Add(balance);
        }
        balance.RdoBalance = request.RdoBalance;
        balance.RphBalance = request.RphBalance;
        balance.AlBalance = request.AlBalance;
        await db.SaveChangesAsync();
        return balance;
    }
}
