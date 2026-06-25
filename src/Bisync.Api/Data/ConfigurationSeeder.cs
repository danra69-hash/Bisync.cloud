using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Bisync.Api.Data;

public static class ConfigurationSeeder
{
    const string DefaultAccessJson = """{"modules":[]}""";

    sealed record CompanySeed(
        string Name,
        string Brn,
        string GstTin,
        string CountryCode,
        string AddressLine1,
        string AddressLine2,
        string City,
        string StateProvince,
        string Postcode,
        string Phone,
        string Fax,
        string Email
    );

    sealed record UserSeed(
        string FullName,
        string Email,
        string Role,
        string Phone,
        string CompanyName,
        string[] LocationExternalIds,
        string AccessJson
    );

    sealed record LocationSeed(
        string ExternalId,
        string Name,
        string CompanyName,
        string AddressLine1,
        string City,
        string StateProvince,
        string Postcode,
        string PrincipalContactEmail
    );

    static readonly CompanySeed[] Companies =
    [
        new(
            "Bisync Hospitality Sdn Bhd",
            "202301012345",
            "SST-2023-00123456",
            "MY",
            "Level 12, Menara Bisync",
            "Jalan Sultan Ismail",
            "Kuala Lumpur",
            "Wilayah Persekutuan",
            "50250",
            "+60 3-2145 6789",
            "+60 3-2145 6790",
            "hq@bisync.cloud"
        ),
        new(
            "Bisync Retail Pte Ltd",
            "201934587N",
            "GST-2019-34587",
            "SG",
            "20 Anson Road",
            "#18-02",
            "Singapore",
            "Singapore",
            "079912",
            "+65 6123 4567",
            "+65 6123 4568",
            "sg@bisync.cloud"
        ),
        new(
            "Bisync Eats Australia Pty Ltd",
            "ACN 665 910 224",
            "ABN 19 665 910 224",
            "AU",
            "80 Collins Street",
            "Level 9",
            "Melbourne",
            "Victoria",
            "3000",
            "+61 3 8456 1200",
            "+61 3 8456 1201",
            "au@bisync.cloud"
        ),
    ];

    static readonly UserSeed[] Users =
    [
        new("James Dubois", "james.dubois@bisync.cloud", "Head Chef", "+60 12-111 2233", "Bisync Hospitality Sdn Bhd", ["downtown", "westend"], """{"modules":["RMS"],"rms":{"enabled":true,"tasks":{"viewOrder":true,"createEditOrder":true,"productManagement":true,"createEdit":true,"viewVendorList":true,"viewReports":true}}}"""),
        new("Sarah Chen", "sarah.chen@bisync.cloud", "Operations Manager", "+60 16-222 3344", "Bisync Hospitality Sdn Bhd", ["downtown", "midtown", "airport", "westend"], DefaultAccessJson),
        new("Ahmad Razali", "ahmad.razali@bisync.cloud", "Location Manager", "+60 19-333 4455", "Bisync Hospitality Sdn Bhd", ["midtown", "airport"], DefaultAccessJson),
        new("Melissa Tan", "melissa.tan@bisync.cloud", "Finance Admin", "+60 17-444 5566", "Bisync Hospitality Sdn Bhd", ["downtown", "midtown", "airport", "westend"], DefaultAccessJson),
        new("Nadia Lim", "nadia.lim@bisync.cloud", "Retail Lead", "+65 8123 9901", "Bisync Retail Pte Ltd", ["sg-marina", "sg-orchard"], DefaultAccessJson),
        new("Ethan Goh", "ethan.goh@bisync.cloud", "Store Supervisor", "+65 8123 9902", "Bisync Retail Pte Ltd", ["sg-marina", "sg-orchard"], DefaultAccessJson),
        new("Olivia Brooks", "olivia.brooks@bisync.cloud", "Regional Manager", "+61 412 556 771", "Bisync Eats Australia Pty Ltd", ["au-cbd", "au-southbank"], DefaultAccessJson),
        new("Liam Carter", "liam.carter@bisync.cloud", "Operations Analyst", "+61 412 556 772", "Bisync Eats Australia Pty Ltd", ["au-cbd"], DefaultAccessJson),
    ];

    static readonly LocationSeed[] Locations =
    [
        new("downtown", "Downtown", "Bisync Hospitality Sdn Bhd", "12 King St", "Kuala Lumpur", "Wilayah Persekutuan", "50000", "james.dubois@bisync.cloud"),
        new("midtown", "Midtown", "Bisync Hospitality Sdn Bhd", "88 Park Ave", "Petaling Jaya", "Selangor", "47810", "ahmad.razali@bisync.cloud"),
        new("airport", "Airport Terminal", "Bisync Hospitality Sdn Bhd", "T2 Departures", "Sepang", "Selangor", "43900", "ahmad.razali@bisync.cloud"),
        new("westend", "West End", "Bisync Hospitality Sdn Bhd", "5 Harbour Walk", "George Town", "Penang", "10200", "james.dubois@bisync.cloud"),
        new("sg-marina", "Marina Square", "Bisync Retail Pte Ltd", "6 Raffles Blvd", "Singapore", "Singapore", "039594", "nadia.lim@bisync.cloud"),
        new("sg-orchard", "Orchard Gateway", "Bisync Retail Pte Ltd", "277 Orchard Road", "Singapore", "Singapore", "238858", "ethan.goh@bisync.cloud"),
        new("au-cbd", "Melbourne CBD", "Bisync Eats Australia Pty Ltd", "250 Flinders Lane", "Melbourne", "Victoria", "3000", "olivia.brooks@bisync.cloud"),
        new("au-southbank", "Southbank", "Bisync Eats Australia Pty Ltd", "3 Southgate Ave", "Southbank", "Victoria", "3006", "olivia.brooks@bisync.cloud"),
    ];

    public static async Task SeedAsync(BisyncDbContext db)
    {
        foreach (var seed in Companies)
        {
            var company = await db.Companies.FirstOrDefaultAsync(c => c.Name == seed.Name);
            if (company is null)
            {
                company = new Company();
                db.Companies.Add(company);
            }

            company.Name = seed.Name;
            company.Brn = seed.Brn;
            company.GstTin = seed.GstTin;
            company.CountryCode = seed.CountryCode;
            company.AddressLine1 = seed.AddressLine1;
            company.AddressLine2 = seed.AddressLine2;
            company.City = seed.City;
            company.StateProvince = seed.StateProvince;
            company.Postcode = seed.Postcode;
            company.Phone = seed.Phone;
            company.Fax = seed.Fax;
            company.Email = seed.Email;
            company.Active = true;
        }
        await db.SaveChangesAsync();

        var companiesByName = await db.Companies.ToDictionaryAsync(c => c.Name);

        foreach (var seed in Users)
        {
            var user = await db.AppUsers.FirstOrDefaultAsync(u => u.Email == seed.Email);
            if (user is null)
            {
                user = new AppUser();
                db.AppUsers.Add(user);
            }

            user.FullName = seed.FullName;
            user.Email = seed.Email;
            user.Role = seed.Role;
            user.Phone = seed.Phone;
            user.Active = true;
            user.AccessJson = seed.AccessJson;
            user.CompanyId = companiesByName[seed.CompanyName].Id;
        }
        await db.SaveChangesAsync();

        var usersByEmail = await db.AppUsers.ToDictionaryAsync(u => u.Email);

        foreach (var seed in Locations)
        {
            var location = await db.Locations.FirstOrDefaultAsync(l => l.ExternalId == seed.ExternalId);
            if (location is null)
            {
                location = new Location
                {
                    ExternalId = seed.ExternalId,
                };
                db.Locations.Add(location);
            }

            var company = companiesByName[seed.CompanyName];
            var contact = usersByEmail[seed.PrincipalContactEmail];

            location.Name = seed.Name;
            location.CompanyId = company.Id;
            location.AddressLine1 = seed.AddressLine1;
            location.AddressLine2 = string.Empty;
            location.City = seed.City;
            location.StateProvince = seed.StateProvince;
            location.Postcode = seed.Postcode;
            location.PrincipalContactUserId = contact.Id;
            location.Address = $"{seed.AddressLine1}, {seed.City}, {seed.StateProvince} {seed.Postcode}";
        }
        await db.SaveChangesAsync();

        var locationIdsByExternalId = await db.Locations.ToDictionaryAsync(l => l.ExternalId, l => l.Id);

        foreach (var seed in Users)
        {
            var user = usersByEmail[seed.Email];
            var locationIds = seed.LocationExternalIds
                .Where(locationIdsByExternalId.ContainsKey)
                .Select(externalId => locationIdsByExternalId[externalId])
                .ToList();
            user.LocationIdsJson = JsonSerializer.Serialize(locationIds);
        }

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
