using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

/// <summary>Dedicated audit-trail database (bisync_audit). Not the operational or stock-card archive DB.</summary>
public class SystemAuditDbContext(DbContextOptions<SystemAuditDbContext> options) : DbContext(options)
{
    public DbSet<SystemAuditEvent> SystemAuditEvents => Set<SystemAuditEvent>();
    public DbSet<ArchivedSystemAuditEvent> ArchivedSystemAuditEvents => Set<ArchivedSystemAuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SystemAuditEvent>(e =>
        {
            e.ToTable("SystemAuditEvents");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Year, x.Month });
            e.HasIndex(x => x.OccurredAtUtc);
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => x.LocationId);
            e.HasIndex(x => x.Category);
            e.HasIndex(x => x.UserId);
            e.Property(x => x.Category).HasMaxLength(32);
            e.Property(x => x.Action).HasMaxLength(128);
            e.Property(x => x.TimeZoneId).HasMaxLength(64);
            e.Property(x => x.CountryCode).HasMaxLength(8);
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.LocationName).HasMaxLength(256);
            e.Property(x => x.DatabaseBucket).HasMaxLength(128);
            e.Property(x => x.EntityType).HasMaxLength(128);
            e.Property(x => x.EntityKey).HasMaxLength(128);
            e.Property(x => x.Summary).HasMaxLength(1000);
        });

        modelBuilder.Entity<ArchivedSystemAuditEvent>(e =>
        {
            e.ToTable("ArchivedSystemAuditEvents");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.OriginalId).IsUnique();
            e.HasIndex(x => new { x.Year, x.Month });
            e.HasIndex(x => x.OccurredAtUtc);
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => x.LocationId);
            e.Property(x => x.Category).HasMaxLength(32);
            e.Property(x => x.Action).HasMaxLength(128);
            e.Property(x => x.TimeZoneId).HasMaxLength(64);
            e.Property(x => x.CountryCode).HasMaxLength(8);
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.LocationName).HasMaxLength(256);
            e.Property(x => x.DatabaseBucket).HasMaxLength(128);
            e.Property(x => x.EntityType).HasMaxLength(128);
            e.Property(x => x.EntityKey).HasMaxLength(128);
            e.Property(x => x.Summary).HasMaxLength(1000);
        });
    }
}
