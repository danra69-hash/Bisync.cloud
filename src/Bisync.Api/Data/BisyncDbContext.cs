using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public class BisyncDbContext(DbContextOptions<BisyncDbContext> options) : DbContext(options)
{
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<InventoryAlert> InventoryAlerts => Set<InventoryAlert>();
    public DbSet<RevenueDataPoint> RevenueDataPoints => Set<RevenueDataPoint>();
    public DbSet<DevelopmentMilestone> DevelopmentMilestones => Set<DevelopmentMilestone>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Location>().HasIndex(l => l.ExternalId).IsUnique();
        modelBuilder.Entity<Location>()
            .HasOne(l => l.Company)
            .WithMany(c => c.Locations)
            .HasForeignKey(l => l.CompanyId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<Location>()
            .HasOne(l => l.PrincipalContact)
            .WithMany()
            .HasForeignKey(l => l.PrincipalContactUserId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<Vendor>().HasIndex(v => v.ExternalId).IsUnique();
        modelBuilder.Entity<PurchaseOrder>().HasIndex(p => p.PoNumber).IsUnique();
        modelBuilder.Entity<PurchaseOrder>()
            .HasMany(p => p.Items)
            .WithOne(i => i.PurchaseOrder)
            .HasForeignKey(i => i.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
