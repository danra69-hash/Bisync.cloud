using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public class StockCardArchiveDbContext(DbContextOptions<StockCardArchiveDbContext> options) : DbContext(options)
{
    public DbSet<ArchivedInventoryMovement> ArchivedInventoryMovements => Set<ArchivedInventoryMovement>();
    public DbSet<ArchivedInventoryPurchase> ArchivedInventoryPurchases => Set<ArchivedInventoryPurchase>();
    public DbSet<ArchivedProductProductionLog> ArchivedProductProductionLogs => Set<ArchivedProductProductionLog>();
    public DbSet<StockCardArchiveRun> ArchiveRuns => Set<StockCardArchiveRun>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ArchivedInventoryMovement>()
            .HasIndex(m => m.OriginalId)
            .IsUnique();
        modelBuilder.Entity<ArchivedInventoryPurchase>()
            .HasIndex(p => p.OriginalId)
            .IsUnique();
        modelBuilder.Entity<ArchivedProductProductionLog>()
            .HasIndex(l => l.OriginalId)
            .IsUnique();
        modelBuilder.Entity<StockCardArchiveRun>()
            .HasIndex(r => r.RanAt);
    }
}
