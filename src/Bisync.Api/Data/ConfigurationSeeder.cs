using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Bisync.Api.Data;

public static class ConfigurationSeeder
{
    public static async Task SeedAsync(BisyncDbContext db)
    {
        if (await db.Companies.AnyAsync()) return;

        var users = new List<AppUser>
        {
            new AppUser
            {
                FullName = "James Dubois",
                Email = "james.dubois@bisync.cloud",
                Role = "Head Chef",
                Phone = "+60 12-111 2233",
                Active = true,
                AccessJson = """{"modules":["RMS"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"productManagement":true,"createEdit":true,"viewVendorList":true,"viewReports":true}}}""",
            },
            new AppUser { FullName = "Sarah Chen", Email = "sarah.chen@bisync.cloud", Role = "Operations Manager", Phone = "+60 16-222 3344", Active = true },
            new AppUser { FullName = "Ahmad Razali", Email = "ahmad.razali@bisync.cloud", Role = "Location Manager", Phone = "+60 19-333 4455", Active = true },
            new AppUser { FullName = "Melissa Tan", Email = "melissa.tan@bisync.cloud", Role = "Finance Admin", Phone = "+60 17-444 5566", Active = true },
        };
        db.AppUsers.AddRange(users);
        await db.SaveChangesAsync();

        var company = new Company
        {
            Name = "Bisync Hospitality Sdn Bhd",
            Brn = "202301012345",
            GstTin = "SST-2023-00123456",
            CountryCode = "MY",
            AddressLine1 = "Level 12, Menara Bisync",
            AddressLine2 = "Jalan Sultan Ismail",
            City = "Kuala Lumpur",
            StateProvince = "Wilayah Persekutuan",
            Postcode = "50250",
            Phone = "+60 3-2145 6789",
            Fax = "+60 3-2145 6790",
            Email = "hq@bisync.cloud",
            Active = true,
        };
        db.Companies.Add(company);
        await db.SaveChangesAsync();

        var locations = await db.Locations.ToListAsync();
        var james = users[0];
        var ahmad = users[2];

        var assignments = new (string externalId, string line1, string city, string state, string postcode, AppUser contact)[]
        {
            ("downtown", "12 King St", "Kuala Lumpur", "Wilayah Persekutuan", "50000", james),
            ("midtown", "88 Park Ave", "Petaling Jaya", "Selangor", "47810", ahmad),
            ("airport", "T2 Departures", "Sepang", "Selangor", "43900", ahmad),
            ("westend", "5 Harbour Walk", "George Town", "Penang", "10200", james),
        };

        foreach (var (externalId, line1, city, state, postcode, contact) in assignments)
        {
            var loc = locations.FirstOrDefault(l => l.ExternalId == externalId);
            if (loc is null) continue;
            loc.CompanyId = company.Id;
            loc.AddressLine1 = line1;
            loc.City = city;
            loc.StateProvince = state;
            loc.Postcode = postcode;
            loc.PrincipalContactUserId = contact.Id;
            loc.Address = $"{line1}, {city}, {state} {postcode}";
        }

        var locByExt = locations.ToDictionary(l => l.ExternalId);
        users[0].CompanyId = company.Id;
        users[0].LocationIdsJson = JsonSerializer.Serialize(new[] { locByExt["downtown"].Id, locByExt["westend"].Id });
        users[1].CompanyId = company.Id;
        users[1].LocationIdsJson = JsonSerializer.Serialize(locations.Select(l => l.Id).ToList());
        users[2].CompanyId = company.Id;
        users[2].LocationIdsJson = JsonSerializer.Serialize(new[] { locByExt["midtown"].Id, locByExt["airport"].Id });
        users[3].CompanyId = company.Id;
        users[3].LocationIdsJson = JsonSerializer.Serialize(locations.Select(l => l.Id).ToList());

        await db.SaveChangesAsync();
    }

    public static async Task PatchUserAssignmentsAsync(BisyncDbContext db)
    {
        var company = await db.Companies.AsNoTracking().FirstOrDefaultAsync();
        if (company is null) return;

        var users = await db.AppUsers.Where(u => u.CompanyId == null).ToListAsync();
        if (users.Count == 0) return;

        var locations = await db.Locations.Where(l => l.CompanyId == company.Id).ToListAsync();
        var allIds = locations.Select(l => l.Id).ToList();

        foreach (var user in users)
        {
            user.CompanyId = company.Id;
            var assigned = locations.Where(l => l.PrincipalContactUserId == user.Id).Select(l => l.Id).ToList();
            user.LocationIdsJson = JsonSerializer.Serialize(assigned.Count > 0 ? assigned : allIds);
        }

        await db.SaveChangesAsync();
    }
}
