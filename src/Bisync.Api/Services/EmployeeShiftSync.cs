using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class EmployeeShiftSync
{
    public static void ApplyFromLevel(Employee employee, EmployeeLevel level)
    {
        employee.IsShiftEmployee = level.IsShift;
        employee.ShiftType = null;
        employee.WorkingHoursPerDay = level.WorkingHoursPerDay;
    }

    public static void ApplyFromLevel(Employee employee)
    {
        if (employee.EmployeeLevel is { } level)
            ApplyFromLevel(employee, level);
        else if (employee.EmployeeLevelId is null)
        {
            employee.IsShiftEmployee = false;
            employee.ShiftType = null;
        }
    }
}
