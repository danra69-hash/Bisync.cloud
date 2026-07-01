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
        int? EmployeeLevelId = 1,
        bool PosEnabled = false,
        string AccessJson = """{"modules":[]}"""
    );

    static readonly EmployeeSeed[] Seeds =
    [
        // Bisync Hospitality Sdn Bhd
        new("James Dubois", "james.dubois@bisync.cloud", "+60 12-111 2233", "Kitchen", "Head Chef", new DateOnly(2019, 3, 15), 1, ["downtown", "westend"], 2, true, """{"modules":["RMS"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"productManagement":true,"createEdit":true,"viewVendorList":true,"viewReports":true}}}"""),
        new("Sarah Chen", "sarah.chen@bisync.cloud", "+60 16-222 3344", "Operations", "Operations Manager", new DateOnly(2020, 6, 1), 1, ["downtown", "midtown", "airport", "westend"], 2),
        new("Ahmad Razali", "ahmad.razali@bisync.cloud", "+60 19-333 4455", "Operations", "Location Manager", new DateOnly(2021, 1, 10), 1, ["midtown", "airport"], 2),
        new("Melissa Tan", "melissa.tan@bisync.cloud", "+60 17-444 5566", "Finance", "Finance Admin", new DateOnly(2022, 4, 20), 1, ["downtown", "midtown", "airport", "westend"], 1),
        new("Daniel Ong", "daniel.ong@bisync.cloud", "+60 18-555 6677", "Kitchen", "Sous Chef", new DateOnly(2023, 8, 5), 1, ["downtown"], 2, true),

        // Bisync Hospitality — Service (10)
        new("Nurul Huda Osman", "nurul.huda@bisync.cloud", "+60 12-601 1001", "Service", "Service Manager", new DateOnly(2018, 5, 12), 1, ["downtown", "midtown", "airport", "westend"], 2),
        new("Raj Kumar", "raj.kumar@bisync.cloud", "+60 12-601 1002", "Service", "Service Supervisor", new DateOnly(2020, 3, 8), 1, ["downtown", "midtown"], 2, true),
        new("Siti Aminah Rahman", "siti.aminah@bisync.cloud", "+60 12-601 1003", "Service", "Waiter", new DateOnly(2022, 7, 19), 1, ["downtown"], 1, true),
        new("Wong Mei Ling", "mei.ling@bisync.cloud", "+60 12-601 1004", "Service", "Waiter", new DateOnly(2022, 9, 3), 1, ["midtown"], 1, true),
        new("Arif Hassan", "arif.hassan@bisync.cloud", "+60 12-601 1005", "Service", "Waiter", new DateOnly(2023, 1, 16), 1, ["airport"], 1, true),
        new("Farah Izzati", "farah.izzati@bisync.cloud", "+60 12-601 1006", "Service", "Host", new DateOnly(2023, 4, 22), 1, ["westend"], 1, true),
        new("Kevin Lim", "kevin.lim@bisync.cloud", "+60 12-601 1007", "Service", "Bartender", new DateOnly(2021, 11, 30), 1, ["downtown", "westend"], 1, true),
        new("Priya Menon", "priya.menon@bisync.cloud", "+60 12-601 1008", "Service", "Waiter", new DateOnly(2024, 2, 5), 1, ["midtown", "airport"], 1, true),
        new("Hakim Zulkifli", "hakim.zulkifli@bisync.cloud", "+60 12-601 1009", "Service", "Food Runner", new DateOnly(2024, 6, 10), 1, ["downtown"], 1, true),
        new("Michelle Tan", "michelle.tan@bisync.cloud", "+60 12-601 1010", "Service", "Captain", new DateOnly(2019, 8, 14), 1, ["downtown", "midtown"], 2, true),

        // Bisync Hospitality — Kitchen (8 more; James Dubois + Daniel Ong complete the team of 10)
        new("Marco D'Silva", "marco.silva@bisync.cloud", "+60 12-602 2001", "Kitchen", "Line Cook", new DateOnly(2021, 6, 7), 1, ["downtown"], 1, true),
        new("Aisyah Rahman", "aisyah.rahman@bisync.cloud", "+60 12-602 2002", "Kitchen", "Prep Cook", new DateOnly(2022, 10, 18), 1, ["midtown"], 1, true),
        new("Lorraine Yeoh", "lorraine.yeoh@bisync.cloud", "+60 12-602 2003", "Kitchen", "Pastry Chef", new DateOnly(2020, 4, 25), 1, ["downtown", "westend"], 2, true),
        new("Vijay Nair", "vijay.nair@bisync.cloud", "+60 12-602 2004", "Kitchen", "Line Cook", new DateOnly(2023, 2, 11), 1, ["airport"], 1, true),
        new("Adam Ismail", "adam.ismail@bisync.cloud", "+60 12-602 2005", "Kitchen", "Commis Chef", new DateOnly(2023, 9, 1), 1, ["downtown"], 1, true),
        new("Nur Izzati Kamal", "nur.izzati@bisync.cloud", "+60 12-602 2006", "Kitchen", "Kitchen Assistant", new DateOnly(2024, 3, 20), 1, ["westend"], 1),
        new("Tan Boon Kiat", "boon.kiat@bisync.cloud", "+60 12-602 2007", "Kitchen", "Grill Cook", new DateOnly(2022, 5, 9), 1, ["midtown", "airport"], 1, true),
        new("Ravi Chandran", "ravi.chandran@bisync.cloud", "+60 12-602 2008", "Kitchen", "Kitchen Steward", new DateOnly(2024, 8, 12), 1, ["downtown"], 1),

        // Bisync Retail Pte Ltd
        new("Nadia Lim", "nadia.lim@bisync.cloud", "+65 8123 9901", "Retail", "Retail Lead", new DateOnly(2020, 2, 14), 2, ["sg-marina", "sg-orchard"], 2),
        new("Ethan Goh", "ethan.goh@bisync.cloud", "+65 8123 9902", "Retail", "Store Supervisor", new DateOnly(2021, 7, 1), 2, ["sg-marina", "sg-orchard"], 2, true),
        new("Priya Sharma", "priya.sharma@bisync.cloud", "+65 8123 9903", "Merchandising", "Category Manager", new DateOnly(2022, 3, 18), 2, ["sg-marina"], 2),
        new("Wei Ming Tan", "wei.ming@bisync.cloud", "+65 8123 9904", "Operations", "Inventory Coordinator", new DateOnly(2022, 11, 9), 2, ["sg-orchard"], 1),
        new("Amelia Koh", "amelia.koh@bisync.cloud", "+65 8123 9905", "Customer Experience", "Floor Manager", new DateOnly(2024, 1, 22), 2, ["sg-marina", "sg-orchard"], 2),

        // Bisync Eats Australia Pty Ltd
        new("Olivia Brooks", "olivia.brooks@bisync.cloud", "+61 412 556 771", "Operations", "Regional Manager", new DateOnly(2018, 9, 3), 3, ["au-cbd", "au-southbank"], 2),
        new("Liam Carter", "liam.carter@bisync.cloud", "+61 412 556 772", "Operations", "Operations Analyst", new DateOnly(2021, 5, 17), 3, ["au-cbd"], 1),
        new("Emma Wilson", "emma.wilson@bisync.cloud", "+61 412 556 773", "Kitchen", "Head Chef", new DateOnly(2020, 10, 28), 3, ["au-cbd"], 2, true),
        new("Noah Singh", "noah.singh@bisync.cloud", "+61 412 556 774", "Finance", "Payroll Officer", new DateOnly(2023, 2, 6), 3, ["au-southbank"], 1),
        new("Chloe Nguyen", "chloe.nguyen@bisync.cloud", "+61 412 556 775", "People", "HR Coordinator", new DateOnly(2024, 4, 15), 3, ["au-cbd", "au-southbank"], 1),
    ];

    public static async Task SeedAsync(BisyncDbContext db)
    {
        var locationIdsByExternalId = await LoadLocationIdsAsync(db);

        foreach (var seed in Seeds)
        {
            var employee = await db.Employees
                .Include(e => e.LeaveBalance)
                .FirstOrDefaultAsync(e => e.Email == seed.Email);

            if (employee is not null)
            {
                await EnsureExistingSeedEmployeeLinksAsync(db, employee, seed, locationIdsByExternalId);
                continue;
            }

            employee = new Employee
            {
                EmployeeCode = await EmployeeCodeGenerator.NextCodeAsync(db),
                Email = seed.Email,
                LeaveBalance = new LeaveBalance { AlBalance = 16 },
            };
            db.Employees.Add(employee);

            employee.Name = seed.Name;
            employee.Mobile = seed.Mobile;
            employee.Department = seed.Department;
            employee.Position = seed.Position;
            employee.JoinDate = seed.JoinDate;
            employee.FingerprintEnrolled = false;
            employee.FaceRecognitionEnrolled = false;
            employee.PosEnabled = seed.PosEnabled;
            employee.BisyncEnabled = true;
            employee.WorkingHoursPerDay = 8;
            var resolvedLevelId = await ResolveEmployeeLevelIdAsync(db, seed.EmployeeLevelId);
            if (resolvedLevelId is not null)
                employee.EmployeeLevelId = resolvedLevelId;
            employee.Nationality = seed.CompanyId switch
            {
                1 => "Malaysian",
                2 => "Singaporean",
                _ => "Australian",
            };

            if (seed.PosEnabled)
            {
                employee.PosPin = "1234";
                employee.PosPinMustChange = true;
            }

            employee.PayrollPin = EmployeesController.DefaultPayrollPin;
            employee.PayrollPinMustChange = true;

            await db.SaveChangesAsync();

            if (employee.EmployeeLevelId is int levelId)
            {
                var level = await db.EmployeeLevels.FindAsync(levelId);
                if (level is not null)
                    EmployeeShiftSync.ApplyFromLevel(employee, level);
            }

            await db.SaveChangesAsync();
            await EmployeeAppUserSync.SyncAsync(db, employee, seed.CompanyId);
            await AssignOrgAsync(db, employee, seed.Department);
            await EnsureSeedAppUserCompanyAsync(db, employee, seed, locationIdsByExternalId);
        }
    }

    static async Task EnsureExistingSeedEmployeeLinksAsync(
        BisyncDbContext db,
        Employee employee,
        EmployeeSeed seed,
        Dictionary<string, int> locationIdsByExternalId)
    {
        if (employee.LeaveBalance is null)
        {
            employee.LeaveBalance = new LeaveBalance { AlBalance = 16 };
            await db.SaveChangesAsync();
        }

        if (employee.DepartmentId is null)
            await AssignOrgAsync(db, employee, seed.Department);

        await EmployeeAppUserSync.SyncAsync(db, employee, seed.CompanyId);
        await EnsureSeedAppUserCompanyAsync(db, employee, seed, locationIdsByExternalId);
    }

    static async Task EnsureSeedAppUserCompanyAsync(
        BisyncDbContext db,
        Employee employee,
        EmployeeSeed seed,
        Dictionary<string, int> locationIdsByExternalId)
    {
        var appUser = await db.AppUsers
            .FirstOrDefaultAsync(u => u.EmployeeId == employee.Id || u.Email == employee.Email);

        if (appUser is null) return;

        if (appUser.CompanyId is null)
            appUser.CompanyId = seed.CompanyId;

        if (!string.IsNullOrWhiteSpace(seed.AccessJson)
            && seed.AccessJson != """{"modules":[]}"""
            && (string.IsNullOrWhiteSpace(appUser.AccessJson) || appUser.AccessJson == """{"modules":[]}"""))
        {
            appUser.AccessJson = seed.AccessJson;
        }

        var locationIds = seed.LocationExternalIds
            .Where(locationIdsByExternalId.ContainsKey)
            .Select(externalId => locationIdsByExternalId[externalId])
            .ToList();

        if (locationIds.Count > 0
            && (string.IsNullOrWhiteSpace(appUser.LocationIdsJson) || appUser.LocationIdsJson == "[]"))
        {
            appUser.LocationIdsJson = JsonSerializer.Serialize(locationIds);
        }

        await db.SaveChangesAsync();
    }

    static async Task<int?> ResolveEmployeeLevelIdAsync(BisyncDbContext db, int? preferredId)
    {
        if (preferredId is int id && await db.EmployeeLevels.AnyAsync(l => l.Id == id))
            return id;

        var name = preferredId switch
        {
            >= 3 => "Director",
            2 => "Management",
            _ => "Junior",
        };
        return (await db.EmployeeLevels.AsNoTracking()
            .FirstOrDefaultAsync(l => l.LevelName == name))?.Id;
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
