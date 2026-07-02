using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public class BisyncDbContext(DbContextOptions<BisyncDbContext> options) : DbContext(options)
{
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<EducationRecord> EducationRecords => Set<EducationRecord>();
    public DbSet<PreviousEmployment> PreviousEmployments => Set<PreviousEmployment>();
    public DbSet<EmployeeMovement> EmployeeMovements => Set<EmployeeMovement>();
    public DbSet<PerformanceAppraisal> PerformanceAppraisals => Set<PerformanceAppraisal>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<LeaveBalance> LeaveBalances => Set<LeaveBalance>();
    public DbSet<ShiftSchedule> ShiftSchedules => Set<ShiftSchedule>();
    public DbSet<PublicHoliday> PublicHolidays => Set<PublicHoliday>();
    public DbSet<EmployeeLevel> EmployeeLevels => Set<EmployeeLevel>();
    public DbSet<CompanySetting> CompanySettings => Set<CompanySetting>();
    public DbSet<Division> Divisions => Set<Division>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<PayStructure> PayStructures => Set<PayStructure>();
    public DbSet<PayrollRun> PayrollRuns => Set<PayrollRun>();
    public DbSet<PayrollRunLine> PayrollRunLines => Set<PayrollRunLine>();
    public DbSet<ProvidentFundBracket> ProvidentFundBrackets => Set<ProvidentFundBracket>();
    public DbSet<SocsoBracket> SocsoBrackets => Set<SocsoBracket>();
    public DbSet<MandatoryContribution> MandatoryContributions => Set<MandatoryContribution>();
    public DbSet<IncomeTaxYear> IncomeTaxYears => Set<IncomeTaxYear>();
    public DbSet<IncomeTaxBracket> IncomeTaxBrackets => Set<IncomeTaxBracket>();
    public DbSet<IncomeTaxRelief> IncomeTaxReliefs => Set<IncomeTaxRelief>();
    public DbSet<IncomeTaxRebate> IncomeTaxRebates => Set<IncomeTaxRebate>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<InventoryPurchase> InventoryPurchases => Set<InventoryPurchase>();
    public DbSet<CashPurchase> CashPurchases => Set<CashPurchase>();
    public DbSet<VendorProductPrice> VendorProductPrices => Set<VendorProductPrice>();
    public DbSet<InventoryAlert> InventoryAlerts => Set<InventoryAlert>();
    public DbSet<RevenueDataPoint> RevenueDataPoints => Set<RevenueDataPoint>();
    public DbSet<DevelopmentMilestone> DevelopmentMilestones => Set<DevelopmentMilestone>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();

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
        modelBuilder.Entity<AppUser>(e =>
        {
            e.ToTable("AppUsers");
            e.Property(x => x.FullName).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.Role).HasMaxLength(100);
            e.Property(x => x.Phone).HasMaxLength(30);
            e.HasOne(u => u.Employee)
                .WithMany()
                .HasForeignKey(u => u.EmployeeId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(u => u.EmployeeId).IsUnique();
        });
        HrModelConfiguration.Configure(modelBuilder);
        modelBuilder.Entity<Vendor>().HasIndex(v => v.ExternalId).IsUnique();
        modelBuilder.Entity<Ingredient>(e =>
        {
            e.Property(x => x.ComponentId).HasMaxLength(32);
            e.Property(x => x.Name).HasMaxLength(200);
            e.HasIndex(x => x.ComponentId).IsUnique();
            e.HasIndex(x => x.Name).IsUnique();
        });
        modelBuilder.Entity<PurchaseOrder>().HasIndex(p => p.PoNumber).IsUnique();
        modelBuilder.Entity<PurchaseOrder>()
            .HasMany(p => p.Items)
            .WithOne(i => i.PurchaseOrder)
            .HasForeignKey(i => i.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<InventoryPurchase>().HasIndex(i => i.PurchaseOrderItemId);
        modelBuilder.Entity<VendorProductPrice>().HasKey(p => p.ExternalId);
    }
}
