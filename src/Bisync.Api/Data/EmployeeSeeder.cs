using System.Text.Json;
using Bisync.Api.Controllers;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class EmployeeSeeder
{
    sealed record EmployeeSeed(
        string Name,
        string Email,
        string Mobile,
        string Department,
        string Position,
        DateOnly JoinDate,
        int CompanyId,
        string[] LocationExternalIds,
        int? EmployeeLevelId = 2,
        bool PosEnabled = false,
        string AccessJson = """{"modules":[]}"""
    );

    static readonly EmployeeSeed[] Seeds =
    [
        // Bisync Hospitality Sdn Bhd
        new("James Dubois", "james.dubois@bisync.cloud", "+60 12-111 2233", "Kitchen", "Head Chef", new DateOnly(2019, 3, 15), 1, ["downtown", "westend"], 3, true, """{"modules":["RMS"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"productManagement":true,"createEdit":true,"viewVendorList":true,"viewReports":true}}}"""),
        new("Sarah Chen", "sarah.chen@bisync.cloud", "+60 16-222 3344", "Operations", "Operations Manager", new DateOnly(2020, 6, 1), 1, ["downtown", "midtown", "airport", "westend"], 4),
        new("Ahmad Razali", "ahmad.razali@bisync.cloud", "+60 19-333 4455", "Operations", "Location Manager", new DateOnly(2021, 1, 10), 1, ["midtown", "airport"], 3),
        new("Melissa Tan", "melissa.tan@bisync.cloud", "+60 17-444 5566", "Finance", "Finance Admin", new DateOnly(2022, 4, 20), 1, ["downtown", "midtown", "airport", "westend"], 2),
        new("Daniel Ong", "daniel.ong@bisync.cloud", "+60 18-555 6677", "Kitchen", "Sous Chef", new DateOnly(2023, 8, 5), 1, ["downtown"], 2, true),

        // Bisync Retail Pte Ltd
        new("Nadia Lim", "nadia.lim@bisync.cloud", "+65 8123 9901", "Retail", "Retail Lead", new DateOnly(2020, 2, 14), 2, ["sg-marina", "sg-orchard"], 3),
        new("Ethan Goh", "ethan.goh@bisync.cloud", "+65 8123 9902", "Retail", "Store Supervisor", new DateOnly(2021, 7, 1), 2, ["sg-marina", "sg-orchard"], 2, true),
        new("Priya Sharma", "priya.sharma@bisync.cloud", "+65 8123 9903", "Merchandising", "Category Manager", new DateOnly(2022, 3, 18), 2, ["sg-marina"], 3),
        new("Wei Ming Tan", "wei.ming@bisync.cloud", "+65 8123 9904", "Operations", "Inventory Coordinator", new DateOnly(2022, 11, 9), 2, ["sg-orchard"], 2),
        new("Amelia Koh", "amelia.koh@bisync.cloud", "+65 8123 9905", "Customer Experience", "Floor Manager", new DateOnly(2024, 1, 22), 2, ["sg-marina", "sg-orchard"], 2),

        // Bisync Eats Australia Pty Ltd
        new("Olivia Brooks", "olivia.brooks@bisync.cloud", "+61 412 556 771", "Operations", "Regional Manager", new DateOnly(2018, 9, 3), 3, ["au-cbd", "au-southbank"], 4),
        new("Liam Carter", "liam.carter@bisync.cloud", "+61 412 556 772", "Operations", "Operations Analyst", new DateOnly(2021, 5, 17), 3, ["au-cbd"], 2),
        new("Emma Wilson", "emma.wilson@bisync.cloud", "+61 412 556 773", "Kitchen", "Head Chef", new DateOnly(2020, 10, 28), 3, ["au-cbd"], 3, true),
        new("Noah Singh", "noah.singh@bisync.cloud", "+61 412 556 774", "Finance", "Payroll Officer", new DateOnly(2023, 2, 6), 3, ["au-southbank"], 2),
        new("Chloe Nguyen", "chloe.nguyen@bisync.cloud", "+61 412 556 775", "People", "HR Coordinator", new DateOnly(2024, 4, 15), 3, ["au-cbd", "au-southbank"], 2),
    ];

    public static async Task SeedAsync(BisyncDbContext db)
    {
        var locationIdsByExternalId = await LoadLocationIdsAsync(db);

        foreach (var seed in Seeds)
        {
            var employee = await db.Employees
                .Include(e => e.LeaveBalance)
                .FirstOrDefaultAsync(e => e.Email == seed.Email);

            if (employee is null)
            {
                employee = new Employee
                {
                    EmployeeCode = await EmployeeCodeGenerator.NextCodeAsync(db),
                    Email = seed.Email,
                    LeaveBalance = new LeaveBalance { AlBalance = 16 },
                };
                db.Employees.Add(employee);
            }

            employee.Name = seed.Name;
            employee.Mobile = seed.Mobile;
            employee.Department = seed.Department;
            employee.Position = seed.Position;
            employee.JoinDate = seed.JoinDate;
            employee.FingerprintEnrolled = false;
            employee.FaceRecognitionEnrolled = false;
            employee.FaceRecognitionEnrolled = false;
            employee.PosEnabled = seed.PosEnabled;
            employee.BisyncEnabled = true;
            employee.WorkingHoursPerDay = 8;
            employee.EmployeeLevelId = seed.EmployeeLevelId;
            employee.Nationality = seed.CompanyId switch
            {
                1 => "Malaysian",
                2 => "Singaporean",
                _ => "Australian",
            };

            if (seed.PosEnabled && string.IsNullOrEmpty(employee.PosPin))
            {
                employee.PosPin = "1234";
                employee.PosPinMustChange = true;
            }

            if (string.IsNullOrEmpty(employee.PayrollPin))
            {
                employee.PayrollPin = EmployeesController.DefaultPayrollPin;
                employee.PayrollPinMustChange = true;
            }

            await db.SaveChangesAsync();

            if (employee.EmployeeLevelId is int levelId)
            {
                var level = await db.EmployeeLevels.FindAsync(levelId);
                if (level is not null)
                    EmployeeShiftSync.ApplyFromLevel(employee, level);
            }

            await db.SaveChangesAsync();
            await EmployeeAppUserSync.SyncAsync(db, employee);

            await AssignOrgAsync(db, employee, seed.Department);

            var locationIds = seed.LocationExternalIds
                .Where(locationIdsByExternalId.ContainsKey)
                .Select(externalId => locationIdsByExternalId[externalId])
                .ToList();

            var appUser = await db.AppUsers
                .FirstOrDefaultAsync(u => u.EmployeeId == employee.Id || u.Email == employee.Email);

            if (appUser is not null)
            {
                appUser.EmployeeId = employee.Id;
                appUser.FullName = employee.Name;
                appUser.Email = employee.Email;
                appUser.Role = employee.Position;
                appUser.Phone = employee.Mobile;
                appUser.Active = true;
                appUser.CompanyId = seed.CompanyId;
                if (!string.IsNullOrWhiteSpace(seed.AccessJson) && seed.AccessJson != """{"modules":[]}""")
                    appUser.AccessJson = seed.AccessJson;
                if (locationIds.Count > 0)
                    appUser.LocationIdsJson = JsonSerializer.Serialize(locationIds);
                await db.SaveChangesAsync();
            }
        }
    }

    static async Task<Dictionary<string, int>> LoadLocationIdsAsync(BisyncDbContext db)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        await db.Database.OpenConnectionAsync();
        try
        {
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = """SELECT "ExternalId", "Id" FROM "Locations" """;
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                map[reader.GetString(0)] = reader.GetInt32(1);
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }

        return map;
    }

    static async Task AssignOrgAsync(BisyncDbContext db, Employee employee, string departmentName)
    {
        var department = await db.Departments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Name == departmentName);

        if (department is null) return;

        employee.DepartmentId = department.Id;
        employee.DivisionId = department.DivisionId;
        await db.SaveChangesAsync();
    }
}
