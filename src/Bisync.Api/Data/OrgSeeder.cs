using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class OrgSeeder
{
    sealed record DivisionSeed(string Name, string Code, string[] Departments);

    static readonly DivisionSeed[] Seeds =
    [
        new("Operations", "OPS", ["Operations", "Location Management"]),
        new("Food & Beverage", "FNB", ["Kitchen"]),
        new("Finance", "FIN", ["Finance"]),
        new("Retail", "RTL", ["Retail", "Merchandising", "Customer Experience"]),
        new("Human Resources", "HR", ["People"]),
    ];

    public static async Task SeedAsync(BisyncDbContext db)
    {
        foreach (var seed in Seeds)
        {
            var division = await db.Divisions
                .Include(d => d.Departments)
                .FirstOrDefaultAsync(d => d.Name == seed.Name);

            if (division is null)
            {
                division = new Division { Name = seed.Name, Code = seed.Code };
                db.Divisions.Add(division);
                await db.SaveChangesAsync();
            }
            else if (string.IsNullOrWhiteSpace(division.Code) && !string.IsNullOrWhiteSpace(seed.Code))
            {
                division.Code = seed.Code;
            }

            foreach (var departmentName in seed.Departments)
            {
                if (division.Departments.All(d => d.Name != departmentName))
                {
                    db.Departments.Add(new Department
                    {
                        Name = departmentName,
                        DivisionId = division.Id,
                    });
                }
            }
        }

        await db.SaveChangesAsync();
        await LinkEmployeesAsync(db);
    }

    static async Task LinkEmployeesAsync(BisyncDbContext db)
    {
        var departments = await db.Departments
            .AsNoTracking()
            .Select(d => new { d.Id, d.Name, d.DivisionId })
            .ToListAsync();

        var byName = departments
            .GroupBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var employees = await db.Employees
            .Where(e => e.DepartmentId == null && e.Department != null && e.Department != "")
            .ToListAsync();

        var changed = false;
        foreach (var employee in employees)
        {
            if (!byName.TryGetValue(employee.Department, out var department))
                continue;

            employee.DepartmentId = department.Id;
            employee.DivisionId = department.DivisionId;
            changed = true;
        }

        if (changed)
            await db.SaveChangesAsync();
    }
}
