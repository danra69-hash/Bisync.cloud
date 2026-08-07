using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>
/// Dedicated platform-wide tag-suggestion database (bisync_tag_suggestions).
/// Holds Component Name → Vendor Product relationships aggregated across all tenants.
/// </summary>
public class TagSuggestionDbContext(DbContextOptions<TagSuggestionDbContext> options) : DbContext(options)
{
    public DbSet<TagSuggestionComponent> Components => Set<TagSuggestionComponent>();
    public DbSet<TagSuggestionVendorProduct> VendorProducts => Set<TagSuggestionVendorProduct>();
    public DbSet<TagSuggestionRebuildLog> RebuildLogs => Set<TagSuggestionRebuildLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TagSuggestionComponent>(e =>
        {
            e.ToTable("TagSuggestionComponents");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.CountryCode, x.ComponentNameKey }).IsUnique();
            e.Property(x => x.CountryCode).HasMaxLength(8);
            e.Property(x => x.ComponentNameKey).HasMaxLength(200);
            e.Property(x => x.ComponentName).HasMaxLength(200);
            e.HasMany(x => x.VendorProducts)
                .WithOne(p => p.Component)
                .HasForeignKey(p => p.TagSuggestionComponentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TagSuggestionVendorProduct>(e =>
        {
            e.ToTable("TagSuggestionVendorProducts");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.TagSuggestionComponentId, x.VendorProductNameKey, x.VendorNameKey })
                .IsUnique();
            e.Property(x => x.VendorProductNameKey).HasMaxLength(240);
            e.Property(x => x.VendorProductName).HasMaxLength(240);
            e.Property(x => x.VendorNameKey).HasMaxLength(200);
            e.Property(x => x.VendorName).HasMaxLength(200);
            e.Property(x => x.Probability).HasPrecision(7, 3);
        });

        modelBuilder.Entity<TagSuggestionRebuildLog>(e =>
        {
            e.ToTable("TagSuggestionRebuildLogs");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.CountryCode, x.LocalDate }).IsUnique();
            e.Property(x => x.CountryCode).HasMaxLength(8);
            e.Property(x => x.LocalDate).HasMaxLength(16);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.Message).HasMaxLength(1000);
        });
    }
}
