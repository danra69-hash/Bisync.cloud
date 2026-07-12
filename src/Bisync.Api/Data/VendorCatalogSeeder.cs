using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Ensures vendors referenced by the client product catalog exist in the database.
/// Safe to run on every startup — only inserts missing vendors.
/// </summary>
public static class VendorCatalogSeeder
{
    private static readonly VendorSeedRecord[] CatalogVendors =
    [
        new("V001", "Premium Meats Co.", "offline", "202001012345", "Proteins, Poultry",
            "Kuala Lumpur", "WP", "Ahmad Razali", "Sales Manager", "+60 12-345 6789", "sales@premiummeats.my",
            "12 Jalan Semarak, KL 50450", true),
        new("V002", "Fine Truffle Imports", "offline", "201801056789", "Truffles, Specialty",
            "Petaling Jaya", "Selangor", "Jean-Luc Prive", "Account Manager", "+60 16-778 9900", "jl@truffleimports.com",
            "88 Jalan PJ 14, PJ 47810", true),
        new("V003", "Artisan Dairy Co.", "offline", "201601034321", "Dairy, Cheese",
            "Kuala Lumpur", "WP", "Sofia Lim", "Sales Executive", "+60 18-901 2233", "orders@artisandairy.my",
            "45 Jalan Tun Razak, KL 50400", false),
        new("V004", "Wine & Spirits Direct", "online", "202201034567", "Wine, Spirits, Beer",
            "Kuala Lumpur", "WP", "Melissa Tan", "Sales Executive", "+60 19-887 6543", "melissa@winedirect.my",
            "Online — Nationwide Delivery", true),
        new("V005", "Ocean Fresh Seafood", "offline", "201701023456", "Seafood, Fresh Fish",
            "Port Klang", "Selangor", "Haji Sulaiman", "Sales Manager", "+60 13-456 7890", "fresh@oceanfish.my",
            "Lot 22, Jln Pelabuhan, Port Klang", false),
        new("V006", "Green Valley Produce", "online", "202001067890", "Produce, Fresh Vegetables",
            "Cameron Highlands", "Pahang", "Lee Wei Jie", "Account Manager", "+60 12-778 3344", "sales@greenvalley.my",
            "Online — Nationwide Delivery", false),
        new("V007", "Heritage Pantry Supply", "offline", "201901078901", "Dry Goods, Canned Goods",
            "Shah Alam", "Selangor", "Ravi Kumar", "Sales Manager", "+60 17-234 5678", "sales@heritagepantry.my",
            "Lot 8, Jalan Stesen 19/7, Shah Alam 40300", false),
        new("V010", "Bean Brothers Roasters", "offline", "202101011234", "Coffee, Beverages",
            "Petaling Jaya", "Selangor", "Marcus Tan", "Sales Manager", "+60 16-445 6677", "wholesale@beanbrothers.my",
            "22 Jalan SS15, PJ 47500", false),
        new("V011", "Metro Canned Foods", "offline", "201801045678", "Dry Goods, Canned Goods",
            "Kuala Lumpur", "WP", "Nurul Izzati", "Account Manager", "+60 12-556 7890", "orders@metrocanned.my",
            "56 Jalan Ipoh, KL 51200", false),
        new("V012", "Pacific Poultry Supply", "offline", "201501012345", "Poultry, Duck",
            "Kajang", "Selangor", "Tan Mei Ling", "Sales Manager", "+60 12-111 2233", "sales@pacificpoultry.my",
            "Lot 5, Jalan Mewah, Kajang 43000", false),
        new("V013", "Harbour Fish Market", "offline", "201601023456", "Seafood, Fresh Fish",
            "Port Klang", "Selangor", "Captain Wong", "Account Manager", "+60 16-222 3344", "orders@harbourfish.my",
            "Pasar Besar, Port Klang 42000", false),
        new("V014", "Valley Dairy Wholesale", "offline", "201701034567", "Dairy, Cream, Butter",
            "Seremban", "Negeri Sembilan", "Priya Nair", "Sales Executive", "+60 17-333 4455", "wholesale@valleydairy.my",
            "12 Jalan Dairy, Seremban 70000", false),
        new("V015", "Mediterranean Oil Co.", "offline", "201801045678", "Oils, Vinegars",
            "Kuala Lumpur", "WP", "Marco Rossi", "Sales Manager", "+60 18-444 5566", "marco@medoil.my",
            "88 Jalan Ampang, KL 50450", false),
        new("V016", "Spice Route Trading", "offline", "201901056789", "Spices, Seasonings",
            "Melaka", "Melaka", "Aisha Rahman", "Account Manager", "+60 19-555 6677", "aisha@spiceroute.my",
            "45 Jalan Hang Tuah, Melaka 75300", false),
        new("V017", "Fresh Herb Gardens", "online", "202001067890", "Herbs, Salad Leaves",
            "Cameron Highlands", "Pahang", "David Choong", "Sales Executive", "+60 12-666 7788", "orders@freshherb.my",
            "Online — Nationwide Delivery", false),
        new("V018", "Grain & Mill Co.", "offline", "202101078901", "Rice, Flour, Grains",
            "Shah Alam", "Selangor", "Hassan Ibrahim", "Sales Manager", "+60 13-777 8899", "sales@grainmill.my",
            "Lot 3, Jalan Bukit Raja, Shah Alam 40000", false),
        new("V019", "Noodle House Supply", "offline", "202201089012", "Pasta, Noodles",
            "Petaling Jaya", "Selangor", "Lily Tan", "Account Manager", "+60 14-888 9900", "lily@noodlehouse.my",
            "18 Jalan SS2, PJ 47300", false),
        new("V020", "Frozen Foods Express", "offline", "202301090123", "Frozen Vegetables, Fries",
            "Subang Jaya", "Selangor", "Kevin Lim", "Sales Executive", "+60 15-999 0011", "kevin@frozenexpress.my",
            "7 Jalan SS15, Subang 47500", false),
        new("V021", "Juice Factory Direct", "offline", "202401101234", "Juices, Purees",
            "Kuala Lumpur", "WP", "Siti Aminah", "Sales Manager", "+60 16-101 1122", "orders@juicefactory.my",
            "22 Jalan Tun Razak, KL 50400", false),
        new("V022", "Craft Brew Alliance", "offline", "202501112345", "Craft Beer, Kegs",
            "Petaling Jaya", "Selangor", "Jake Morrison", "Account Manager", "+60 17-202 2233", "jake@craftbrew.my",
            "5 Jalan Gasing, PJ 46000", false),
        new("V023", "Tea & Tisane Co.", "online", "202601123456", "Tea, Herbal Infusions",
            "Ipoh", "Perak", "Mei Lin", "Sales Executive", "+60 18-303 3344", "sales@teatisane.my",
            "Online — Nationwide Delivery", false),
        new("V024", "Syrup & Mixers Ltd", "offline", "202701134567", "Syrups, Mixers, Tonic",
            "Kuala Lumpur", "WP", "Raj Patel", "Sales Manager", "+60 19-404 4455", "raj@syrupmixers.my",
            "33 Jalan Bukit Bintang, KL 55100", false),
        new("V025", "Plant Milk Wholesale", "offline", "202801145678", "Oat Milk, Plant Milks",
            "Shah Alam", "Selangor", "Emma Walsh", "Account Manager", "+60 12-505 5566", "emma@plantmilk.my",
            "9 Jalan Plumbum, Shah Alam 40300", false),
        new("V026", "Butcher Block Prime", "offline", "202901156789", "Lamb, Pork, Premium Meats",
            "Kuala Lumpur", "WP", "Frankie Ho", "Sales Manager", "+60 13-606 6677", "frankie@butcherblock.my",
            "101 Jalan Maarof, KL 59000", false),
        new("V027", "Organic Veg Hub", "online", "203001167890", "Organic Produce",
            "Cameron Highlands", "Pahang", "Nadia Yusof", "Sales Executive", "+60 14-707 7788", "nadia@organicveg.my",
            "Online — Nationwide Delivery", false),
        new("V028", "Condiment Central", "offline", "203101178901", "Sauces, Passata, Condiments",
            "Klang", "Selangor", "Vikram Singh", "Account Manager", "+60 15-808 8899", "vikram@condiment.my",
            "Lot 12, Jalan Kapar, Klang 41000", false),
        new("V029", "Bakery Ingredients MY", "offline", "203201189012", "Flour, Yeast, Baking",
            "Kuala Lumpur", "WP", "Christine Lee", "Sales Manager", "+60 16-909 9900", "christine@bakerying.my",
            "44 Jalan Sultan, KL 50000", false),
        new("V030", "Imported Cheese Cellar", "offline", "203301190123", "Cheese, Dairy Speciality",
            "Petaling Jaya", "Selangor", "Giuseppe Conti", "Account Manager", "+60 17-010 1011", "giuseppe@cheesecellar.my",
            "66 Jalan SS21, PJ 47400", false),
        new("V031", "Bottled Water Works", "offline", "203401201234", "Still Water, Sparkling",
            "Rawang", "Selangor", "Azman Hakim", "Sales Executive", "+60 18-121 2122", "azman@waterworks.my",
            "Lot 8, Jalan Industri, Rawang 48000", false),

        // Halal-certified vendor partners (V042–V051)
        new("V042", "Barakah Halal Meats", "offline", "203501212345", "Halal Beef, Lamb, Poultry",
            "Shah Alam", "Selangor", "Farid Zulkifli", "Sales Manager", "+60 12-301 4455", "orders@barakahhalal.my",
            "Lot 14, Jalan Utama, Shah Alam 40150", true, "halal"),
        new("V043", "Seri Mutiara Halal Seafood", "offline", "203601223456", "Halal Fish, Prawns, Squid",
            "Kuala Terengganu", "Terengganu", "Wan Aisyah", "Account Manager", "+60 13-402 5566", "sales@serimutiara.my",
            "Pasar Besar Tok Bali, KT 20400", true, "halal"),
        new("V044", "Kurnia Poultry Halal", "offline", "203701234567", "Halal Chicken, Marinated Poultry",
            "Kajang", "Selangor", "Hafiz Rahman", "Sales Executive", "+60 14-503 6677", "wholesale@kurniapoultry.my",
            "Lot 9, Jalan Reko, Kajang 43000", false, "halal"),
        new("V045", "Hijrah Fresh Produce Halal", "online", "203801245678", "Halal Fresh Vegetables, Salad",
            "Cameron Highlands", "Pahang", "Nur Hidayah", "Sales Manager", "+60 15-604 7788", "orders@hijrahproduce.my",
            "Online — Nationwide Delivery", true, "halal"),
        new("V046", "Al-Noor Halal Dairy", "offline", "203901256789", "Halal Milk, Cheese, Yogurt",
            "Seremban", "Negeri Sembilan", "Zainab Osman", "Account Manager", "+60 16-705 8899", "sales@alnoordairy.my",
            "22 Jalan Dairy, Seremban 70400", false, "halal"),
        new("V047", "Zam-Zam Beverages Halal", "offline", "204001267890", "Halal Juices, Syrups, Soft Drinks",
            "Kuala Lumpur", "WP", "Amir Hamzah", "Sales Manager", "+60 17-806 9900", "orders@zamzambeverages.my",
            "88 Jalan Tun Razak, KL 50400", true, "halal"),
        new("V048", "Hikmah Spice House", "offline", "204101278901", "Halal Spices, Pastes, Seasonings",
            "Melaka", "Melaka", "Salmah Idris", "Sales Executive", "+60 18-907 1011", "sales@hikmahspice.my",
            "12 Jalan Hang Jebat, Melaka 75200", false, "halal"),
        new("V049", "Raudhah Bakery Supplies Halal", "offline", "204201289012", "Halal Flour, Yeast, Baking",
            "Petaling Jaya", "Selangor", "Aminah Lee", "Account Manager", "+60 19-108 2122", "orders@raudhahbakery.my",
            "33 Jalan SS2, PJ 47300", true, "halal"),
        new("V050", "Nusantara Halal Frozen Foods", "offline", "204301290123", "Halal Frozen Paratha, Pastry, Fish",
            "Subang Jaya", "Selangor", "Rizal Hakimi", "Sales Manager", "+60 12-209 3233", "frozen@nusantarahalal.my",
            "5 Jalan SS16, Subang 47500", false, "halal"),
        new("V051", "Darul Ehsan Halal Pantry", "offline", "204401301234", "Halal Coconut Milk, Sauces, Noodles",
            "Shah Alam", "Selangor", "Kamaluddin Ali", "Sales Executive", "+60 13-310 4344", "pantry@darulehsan.my",
            "Lot 6, Jalan Plumbum, Shah Alam 40300", true, "halal"),
    ];

    public static async Task EnsureCatalogVendorsAsync(BisyncDbContext db)
    {
        var defaultCompanyId = await db.Companies.AsNoTracking()
            .OrderBy(c => c.Id)
            .Select(c => (int?)c.Id)
            .FirstOrDefaultAsync();
        if (defaultCompanyId is null)
            return;

        var existingIds = await db.Vendors
            .Where(v => v.CompanyId == defaultCompanyId)
            .Select(v => v.ExternalId)
            .ToListAsync();

        var existing = new HashSet<string>(existingIds, StringComparer.OrdinalIgnoreCase);
        var added = false;

        foreach (var seed in CatalogVendors)
        {
            if (existing.Contains(seed.ExternalId))
                continue;

            db.Vendors.Add(seed.ToVendor(defaultCompanyId.Value));
            added = true;
        }

        if (added)
            await db.SaveChangesAsync();
    }

    private sealed record VendorSeedRecord(
        string ExternalId,
        string Name,
        string Type,
        string Brn,
        string Products,
        string City,
        string State,
        string ContactPerson,
        string ContactPosition,
        string Mobile,
        string Email,
        string Address,
        bool Engaged,
        string? ProductPolicyTag = null)
    {
        public Vendor ToVendor(int companyId) => new()
        {
            CompanyId = companyId,
            ExternalId = ExternalId,
            Name = Name,
            Type = Type,
            Brn = Brn,
            Products = Products,
            City = City,
            State = State,
            ContactPerson = ContactPerson,
            ContactPosition = ContactPosition,
            Mobile = Mobile,
            Email = Email,
            Address = Address,
            Engaged = Engaged,
            ProductPolicyTag = ProductPolicyTag ?? VendorPolicyRules.InferProductPolicyTag(Name, Products),
        };
    }
}
