using System.Text.Json;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public static class CustomerSeeder
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static async Task EnsureDemoCustomersAsync(BisyncDbContext db)
    {
        if (await db.B2bCustomers.AnyAsync()) return;

        var companyId = await db.Companies.Select(c => c.Id).FirstOrDefaultAsync();
        if (companyId <= 0) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var twoYearsAgo = today.AddYears(-2);

        db.B2bCustomers.AddRange(
            new B2bCustomer
            {
                CompanyId = companyId,
                ExternalId = "B2BC-001",
                CompanyName = "Metro Foods Trading Sdn Bhd",
                Brn = "201901234567",
                Address = "Lot 12, Jalan Perindustrian 3",
                City = "Shah Alam",
                State = "Selangor",
                Postcode = "40000",
                Phone = "+60 3-5512 8800",
                Fax = "+60 3-5512 8801",
                Email = "procurement@metrofoods.my",
                ContactsJson = JsonSerializer.Serialize(new[]
                {
                    new { id = "c1", name = "Ahmad Razif", position = "Procurement Manager", mobile = "+60 12-345 6789", email = "ahmad.razif@metrofoods.my", isDefault = true },
                    new { id = "c2", name = "Siti Nurhaliza", position = "Accounts Executive", mobile = "+60 16-234 5678", email = "siti.nurhaliza@metrofoods.my", isDefault = false },
                }, JsonOptions),
                TaggedProductIdsJson = "[]",
                PurchaseHistoryJson = JsonSerializer.Serialize(new[]
                {
                    new
                    {
                        dateOrdered = twoYearsAgo.AddMonths(3).ToString("yyyy-MM-dd"),
                        dateDelivered = twoYearsAgo.AddMonths(3).AddDays(2).ToString("yyyy-MM-dd"),
                        productName = "Artisan Sourdough Loaf",
                        deliveryUom = "1 Box (12 pcs)",
                        rrp = 48.00m,
                        qtyOrdered = 20m,
                        actualRrp = 46.50m,
                        totalRevenue = 930.00m,
                        cogs = 22.40m,
                        cogsPercent = 48.17m,
                    },
                    new
                    {
                        dateOrdered = today.AddMonths(-2).ToString("yyyy-MM-dd"),
                        dateDelivered = today.AddMonths(-2).AddDays(1).ToString("yyyy-MM-dd"),
                        productName = "Butter Croissant",
                        deliveryUom = "1 Tray (24 pcs)",
                        rrp = 72.00m,
                        qtyOrdered = 15m,
                        actualRrp = 70.00m,
                        totalRevenue = 1050.00m,
                        cogs = 31.50m,
                        cogsPercent = 45.00m,
                    },
                }, JsonOptions),
            },
            new B2bCustomer
            {
                CompanyId = companyId,
                ExternalId = "B2BC-002",
                CompanyName = "Green Leaf Cafés Group",
                Brn = "202003456789",
                Address = "88 Jalan Bukit Bintang",
                City = "Kuala Lumpur",
                State = "Wilayah Persekutuan",
                Postcode = "55100",
                Phone = "+60 3-2145 9900",
                Fax = "",
                Email = "orders@greenleaf.my",
                ContactsJson = JsonSerializer.Serialize(new[]
                {
                    new { id = "c3", name = "David Tan", position = "Operations Director", mobile = "+60 19-876 5432", email = "david.tan@greenleaf.my", isDefault = true },
                }, JsonOptions),
                TaggedProductIdsJson = "[]",
                PurchaseHistoryJson = "[]",
            });

        var currentYear = today.Year;
        db.PosCustomers.AddRange(
            new PosCustomer
            {
                CompanyId = companyId,
                ExternalId = "POSC-001",
                Name = "Nurul Aisyah",
                Address = "15 Jalan Ampang",
                City = "Kuala Lumpur",
                State = "Wilayah Persekutuan",
                Postcode = "50450",
                Phone = "+60 12-998 7766",
                Fax = "",
                Email = "nurul.aisyah@email.com",
                LoyaltySummaryJson = JsonSerializer.Serialize(new[]
                {
                    new { year = currentYear - 1, earned = 1250m, used = 980m, balance = 270m },
                    new { year = currentYear, earned = 840m, used = 320m, balance = 790m },
                }, JsonOptions),
                CouponSummaryJson = JsonSerializer.Serialize(new[]
                {
                    new { year = currentYear - 1, received = 6, used = 5 },
                    new { year = currentYear, received = 4, used = 2 },
                }, JsonOptions),
                ActivityHistoryJson = JsonSerializer.Serialize(BuildPosActivities(today), JsonOptions),
            },
            new PosCustomer
            {
                CompanyId = companyId,
                ExternalId = "POSC-002",
                Name = "James Wong",
                Address = "42 Persiaran KLCC",
                City = "Kuala Lumpur",
                State = "Wilayah Persekutuan",
                Postcode = "50088",
                Phone = "+60 17-445 2211",
                Fax = "",
                Email = "james.wong@email.com",
                LoyaltySummaryJson = JsonSerializer.Serialize(new[]
                {
                    new { year = currentYear, earned = 420m, used = 150m, balance = 270m },
                }, JsonOptions),
                CouponSummaryJson = JsonSerializer.Serialize(new[]
                {
                    new { year = currentYear, received = 2, used = 1 },
                }, JsonOptions),
                ActivityHistoryJson = JsonSerializer.Serialize(BuildPosActivities(today, count: 3), JsonOptions),
            });

        await db.SaveChangesAsync();
    }

    static object[] BuildPosActivities(DateOnly today, int count = 5)
    {
        var types = new[] { "Dine-in", "Take-out", "Pick-up", "Online Delivery" };
        var locations = new[] { "Downtown", "Midtown", "Airport Terminal" };
        var activities = new List<object>();
        var balance = 500m;

        for (var i = 0; i < count; i++)
        {
            var date = today.AddDays(-(i * 7 + 2));
            if (date.Year < today.Year) continue;
            var earned = 25m + (i * 10);
            var used = i % 2 == 0 ? 0m : 15m;
            balance = balance + earned - used;
            var spending = 85m + (i * 22.5m);
            activities.Add(new
            {
                activityDate = date.ToString("yyyy-MM-dd"),
                activityLocation = locations[i % locations.Length],
                activityType = types[i % types.Length],
                checkNo = $"CHK-{date:yyyyMMdd}-{1001 + i}",
                totalSpending = spending,
                pointsEarned = earned,
                pointsUsed = used,
                pointsBalance = balance,
                couponUsed = i == 2 ? "CPN-2026-0042" : (string?)null,
                receiptLines = new[]
                {
                    new { itemName = "Wagyu Burger", qty = 1m, unitPrice = 32.00m, lineTotal = 32.00m },
                    new { itemName = "Craft Beer", qty = 2m, unitPrice = 12.00m, lineTotal = 24.00m },
                    new { itemName = "Service Charge", qty = 1m, unitPrice = spending - 56.00m, lineTotal = spending - 56.00m },
                },
            });
        }

        return activities.ToArray();
    }
}
