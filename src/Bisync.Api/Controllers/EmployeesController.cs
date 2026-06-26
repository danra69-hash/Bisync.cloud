using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/employees")]
public class EmployeesController(BisyncDbContext db) : ControllerBase
{
    public const string DefaultPosPin = "1234";
    public const string DefaultPayrollPin = "000000";

    [HttpGet]
    public async Task<IEnumerable<Employee>> GetAll([FromQuery] string? department, [FromQuery] bool? shift)
    {
        var query = db.Employees.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(department))
            query = query.Where(e => e.Department == department);
        if (shift is not null)
            query = query.Where(e => e.IsShiftEmployee == shift);
        var employees = await query
            .Include(e => e.EmployeeLevel)
            .Include(e => e.ReportsTo)
            .OrderBy(e => e.EmployeeCode)
            .ToListAsync();
        foreach (var employee in employees)
            EmployeeShiftSync.ApplyFromLevel(employee);
        return employees;
    }

    /// <summary>Full profile as shown in the employee detail modal.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Employee>> GetById(int id)
    {
        var employee = await db.Employees
            .AsNoTracking()
            .Include(e => e.EmployeeLevel)
            .Include(e => e.ReportsTo)
            .Include(e => e.Education)
            .Include(e => e.PreviousEmployments)
            .Include(e => e.Movements)
            .Include(e => e.PerformanceAppraisals)
            .FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return NotFound();
        EmployeeShiftSync.ApplyFromLevel(employee);
        return employee;
    }

    [HttpPost]
    public async Task<ActionResult<Employee>> Create(EmployeeRequest request)
    {
        if (request.ReportsToId is int reportsToId &&
            !await db.Employees.AnyAsync(e => e.Id == reportsToId))
            return BadRequest("Reports-to employee not found.");
        if (request.EmployeeLevelId is int levelId &&
            !await db.EmployeeLevels.AnyAsync(l => l.Id == levelId))
            return BadRequest("Employee level not found.");

        var employee = new Employee { EmployeeCode = await EmployeeCodeGenerator.NextCodeAsync(db) };
        if (!await ApplyAsync(employee, request))
            return BadRequest("A valid department is required.");
        await ApplyShiftFromLevel(employee);
        // Every employee gets a balance row; AL starts from the level entitlement when set.
        var level = request.EmployeeLevelId is int assignedLevelId
            ? await db.EmployeeLevels.FindAsync(assignedLevelId)
            : null;
        employee.LeaveBalance = new LeaveBalance { AlBalance = level?.AnnualLeaveDays ?? 0 };

        db.Employees.Add(employee);
        await db.SaveChangesAsync();
        await EmployeeAppUserSync.SyncAsync(db, employee);
        return CreatedAtAction(nameof(GetById), new { id = employee.Id }, employee);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Employee>> Update(int id, EmployeeRequest request)
    {
        var employee = await db.Employees.FindAsync(id);
        if (employee is null) return NotFound();
        if (request.ReportsToId == id)
            return BadRequest("An employee cannot report to themselves.");
        if (request.ReportsToId is int reportsToId &&
            !await db.Employees.AnyAsync(e => e.Id == reportsToId))
            return BadRequest("Reports-to employee not found.");
        if (request.EmployeeLevelId is int levelId &&
            !await db.EmployeeLevels.AnyAsync(l => l.Id == levelId))
            return BadRequest("Employee level not found.");

        if (!await ApplyAsync(employee, request))
            return BadRequest("A valid department is required.");
        await ApplyShiftFromLevel(employee);
        await db.SaveChangesAsync();
        await EmployeeAppUserSync.SyncAsync(db, employee);
        return employee;
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var employee = await db.Employees.FindAsync(id);
        if (employee is null) return NotFound();
        await EmployeeAppUserSync.RemoveAsync(db, id);
        db.Employees.Remove(employee);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/reset-pos-pin")]
    public async Task<ActionResult<Employee>> ResetPosPin(int id)
    {
        var employee = await db.Employees.FindAsync(id);
        if (employee is null) return NotFound();
        if (!employee.PosEnabled)
            return BadRequest("POS is not enabled for this employee.");

        employee.PosPin = DefaultPosPin;
        employee.PosPinMustChange = true;
        await db.SaveChangesAsync();
        return employee;
    }

    [HttpPost("{id:int}/verify-payroll-pin")]
    public async Task<ActionResult<PayrollPinVerifyResult>> VerifyPayrollPin(int id, PayrollPinVerifyRequest request)
    {
        var employee = await db.Employees.FindAsync(id);
        if (employee is null) return NotFound();

        EnsurePayrollPin(employee);
        if (db.Entry(employee).State == EntityState.Modified)
            await db.SaveChangesAsync();

        var pin = request.Pin.Trim();
        if (pin.Length != 6 || !pin.All(char.IsDigit))
            return BadRequest("Payroll PIN must be exactly 6 digits.");

        return new PayrollPinVerifyResult { Valid = employee.PayrollPin == pin };
    }

    [HttpPost("{id:int}/reset-payroll-pin")]
    public async Task<ActionResult<Employee>> ResetPayrollPin(int id)
    {
        var employee = await db.Employees.FindAsync(id);
        if (employee is null) return NotFound();

        employee.PayrollPin = DefaultPayrollPin;
        employee.PayrollPinMustChange = true;
        await db.SaveChangesAsync();
        return employee;
    }

    // --- Child collections from the detail modal ---

    [HttpPost("{id:int}/education")]
    public async Task<ActionResult<EducationRecord>> AddEducation(int id, EducationRecordRequest request)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == id)) return NotFound();
        var record = new EducationRecord
        {
            EmployeeId = id,
            Degree = request.Degree,
            Institution = request.Institution,
            Year = request.Year,
            Certificate = request.Certificate
        };
        db.EducationRecords.Add(record);
        await db.SaveChangesAsync();
        return record;
    }

    [HttpDelete("{id:int}/education/{recordId:int}")]
    public async Task<IActionResult> DeleteEducation(int id, int recordId)
    {
        var record = await db.EducationRecords.FirstOrDefaultAsync(r => r.Id == recordId && r.EmployeeId == id);
        if (record is null) return NotFound();
        db.EducationRecords.Remove(record);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/previous-employments")]
    public async Task<ActionResult<PreviousEmployment>> AddPreviousEmployment(int id, PreviousEmploymentRequest request)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == id)) return NotFound();
        var record = new PreviousEmployment
        {
            EmployeeId = id,
            CompanyName = request.CompanyName,
            Position = request.Position,
            StartYear = request.StartYear,
            EndYear = request.EndYear,
            YearsOfService = request.YearsOfService
        };
        db.PreviousEmployments.Add(record);
        await db.SaveChangesAsync();
        return record;
    }

    [HttpDelete("{id:int}/previous-employments/{recordId:int}")]
    public async Task<IActionResult> DeletePreviousEmployment(int id, int recordId)
    {
        var record = await db.PreviousEmployments.FirstOrDefaultAsync(r => r.Id == recordId && r.EmployeeId == id);
        if (record is null) return NotFound();
        db.PreviousEmployments.Remove(record);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/movements")]
    public async Task<ActionResult<EmployeeMovement>> AddMovement(int id, EmployeeMovementRequest request)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == id)) return NotFound();
        var record = new EmployeeMovement
        {
            EmployeeId = id,
            Date = request.Date,
            FromPosition = request.FromPosition,
            ToPosition = request.ToPosition,
            Type = request.Type,
            Department = request.Department
        };
        db.EmployeeMovements.Add(record);
        await db.SaveChangesAsync();
        return record;
    }

    [HttpDelete("{id:int}/movements/{recordId:int}")]
    public async Task<IActionResult> DeleteMovement(int id, int recordId)
    {
        var record = await db.EmployeeMovements.FirstOrDefaultAsync(r => r.Id == recordId && r.EmployeeId == id);
        if (record is null) return NotFound();
        db.EmployeeMovements.Remove(record);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:int}/appraisals")]
    public async Task<ActionResult<PerformanceAppraisal>> AddAppraisal(int id, PerformanceAppraisalRequest request)
    {
        if (!await db.Employees.AnyAsync(e => e.Id == id)) return NotFound();
        if (await db.PerformanceAppraisals.AnyAsync(a => a.EmployeeId == id && a.Year == request.Year))
            return Conflict($"An appraisal for year {request.Year} already exists.");
        var record = new PerformanceAppraisal
        {
            EmployeeId = id,
            Year = request.Year,
            Rating = request.Rating,
            Score = request.Score,
            Reviewer = request.Reviewer,
            Comments = request.Comments
        };
        db.PerformanceAppraisals.Add(record);
        await db.SaveChangesAsync();
        return record;
    }

    [HttpDelete("{id:int}/appraisals/{recordId:int}")]
    public async Task<IActionResult> DeleteAppraisal(int id, int recordId)
    {
        var record = await db.PerformanceAppraisals.FirstOrDefaultAsync(r => r.Id == recordId && r.EmployeeId == id);
        if (record is null) return NotFound();
        db.PerformanceAppraisals.Remove(record);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<bool> ApplyAsync(Employee employee, EmployeeRequest request)
    {
        employee.Name = request.Name;
        employee.Email = request.Email;
        employee.Mobile = request.Mobile;
        employee.Position = request.Position;
        employee.JoinDate = request.JoinDate;
        employee.FingerprintEnrolled = request.FingerprintEnrolled;
        employee.FaceRecognitionEnrolled = request.FaceRecognitionEnrolled;
        employee.CheckinMethod = request.CheckinMethod;
        ApplyPosAccess(employee, request.PosEnabled || request.CheckinMethod == CheckinMethod.POS);
        employee.BisyncEnabled = request.BisyncEnabled;
        employee.Active = request.Active;
        employee.WorkingHoursPerDay = request.WorkingHoursPerDay;
        employee.EmployeeLevelId = request.EmployeeLevelId;
        employee.ReportsToId = request.ReportsToId;
        employee.Nationality = request.Nationality;
        employee.IdPassportNumber = request.IdPassportNumber;
        employee.DateOfBirth = request.DateOfBirth;
        employee.PersonalEmail = request.PersonalEmail;
        employee.PermanentAddress = request.PermanentAddress;
        employee.BankName = request.BankName?.Trim();
        employee.BankAccountNumber = request.BankAccountNumber?.Trim();
        employee.BankAccountHolderName = request.BankAccountHolderName?.Trim();
        employee.BaseSalary = request.BaseSalary;
        employee.ServiceAllowance = request.ServiceAllowance;
        employee.TransportAllowance = request.TransportAllowance;
        employee.AccommodationAllowance = request.AccommodationAllowance;
        employee.MobileAllowance = request.MobileAllowance;
        employee.WorkPermitByCompany = request.WorkPermitByCompany;
        if (request.OtherAllowances is not null)
        {
            employee.OtherAllowances = request.OtherAllowances
                .Select(a => new PayrollOtherAllowance { Name = a.Name.Trim(), Amount = a.Amount })
                .ToList();
        }
        employee.WorkPermitByCompany = request.WorkPermitByCompany;
        employee.TransportProvided = request.TransportProvided;
        employee.TransportCarModel = request.TransportProvided ? request.TransportCarModel?.Trim() : null;
        employee.TransportPlateNumber = request.TransportProvided ? request.TransportPlateNumber?.Trim() : null;
        employee.AccommodationProvided = request.AccommodationProvided;
        employee.AccommodationAddress = request.AccommodationProvided ? request.AccommodationAddress?.Trim() : null;
        employee.AccommodationLeaseStart = request.AccommodationProvided ? request.AccommodationLeaseStart : null;
        employee.AccommodationLeaseEnd = request.AccommodationProvided ? request.AccommodationLeaseEnd : null;
        employee.MobileProvided = request.MobileProvided;
        employee.MobileAllowancePhone = request.MobileProvided ? request.MobileAllowancePhone?.Trim() : null;
        employee.MobileProvider = request.MobileProvided ? request.MobileProvider?.Trim() : null;
        employee.OvertimeAllowanceEnabled = request.OvertimeAllowanceEnabled;
        employee.BonusEnabled = request.BonusEnabled;
        employee.BonusMonthly = request.BonusEnabled && request.BonusMonthly;
        employee.BonusAnnually = request.BonusEnabled && request.BonusAnnually;
        employee.BonusAmount = request.BonusEnabled ? request.BonusAmount : null;
        employee.BonusByBasicSalary = request.BonusEnabled && request.BonusByBasicSalary;
        employee.BonusByService = request.BonusEnabled && request.BonusByService;
        EnsurePayrollPin(employee);

        if (request.DepartmentId is int departmentId)
        {
            var department = await db.Departments.AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == departmentId);
            if (department is null) return false;
            if (request.DivisionId is int divisionId && divisionId != department.DivisionId)
                return false;

            employee.DepartmentId = departmentId;
            employee.DivisionId = department.DivisionId;
            employee.Department = department.Name;
            return true;
        }

        if (!string.IsNullOrWhiteSpace(request.Department))
        {
            employee.Department = request.Department.Trim();
            employee.DivisionId = request.DivisionId;
            employee.DepartmentId = request.DepartmentId;
            return true;
        }

        return false;
    }

    private async Task ApplyShiftFromLevel(Employee employee)
    {
        if (employee.EmployeeLevelId is not int levelId)
        {
            employee.IsShiftEmployee = false;
            employee.ShiftType = null;
            return;
        }

        var level = await db.EmployeeLevels.FindAsync(levelId);
        if (level is null)
        {
            employee.IsShiftEmployee = false;
            employee.ShiftType = null;
            return;
        }

        EmployeeShiftSync.ApplyFromLevel(employee, level);
    }

    private static void ApplyPosAccess(Employee employee, bool posEnabled)
    {
        var newlyEnabled = posEnabled && !employee.PosEnabled;
        employee.PosEnabled = posEnabled;
        if (posEnabled)
        {
            if (newlyEnabled || string.IsNullOrEmpty(employee.PosPin))
            {
                employee.PosPin = DefaultPosPin;
                employee.PosPinMustChange = true;
            }
        }
        else
        {
            employee.PosPin = null;
            employee.PosPinMustChange = false;
        }
    }

    private static void EnsurePayrollPin(Employee employee)
    {
        if (string.IsNullOrEmpty(employee.PayrollPin))
        {
            employee.PayrollPin = DefaultPayrollPin;
            employee.PayrollPinMustChange = true;
        }
    }
}
