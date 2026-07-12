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
    public DbSet<B2bCustomer> B2bCustomers => Set<B2bCustomer>();
    public DbSet<PosCustomer> PosCustomers => Set<PosCustomer>();
    public DbSet<Ingredient> Ingredients => Set<Ingredient>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<InventoryPurchase> InventoryPurchases => Set<InventoryPurchase>();
    public DbSet<CashPurchase> CashPurchases => Set<CashPurchase>();
    public DbSet<OrderTemplate> OrderTemplates => Set<OrderTemplate>();
    public DbSet<OrderTemplateItem> OrderTemplateItems => Set<OrderTemplateItem>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<ProductComponentItem> ProductComponentItems => Set<ProductComponentItem>();
    public DbSet<ProductPackagingItem> ProductPackagingItems => Set<ProductPackagingItem>();
    public DbSet<ProductAlias> ProductAliases => Set<ProductAlias>();
    public DbSet<ProductB2bLocationStock> ProductB2bLocationStocks => Set<ProductB2bLocationStock>();
    public DbSet<B2bSalesOrder> B2bSalesOrders => Set<B2bSalesOrder>();
    public DbSet<B2bSalesOrderLine> B2bSalesOrderLines => Set<B2bSalesOrderLine>();
    public DbSet<ProductProductionLog> ProductProductionLogs => Set<ProductProductionLog>();
    public DbSet<InventoryMovement> InventoryMovements => Set<InventoryMovement>();
    public DbSet<InventoryCountSession> InventoryCountSessions => Set<InventoryCountSession>();
    public DbSet<InventoryCountSessionLine> InventoryCountSessionLines => Set<InventoryCountSessionLine>();
    public DbSet<VendorProductPrice> VendorProductPrices => Set<VendorProductPrice>();
    public DbSet<InventoryAlert> InventoryAlerts => Set<InventoryAlert>();
    public DbSet<RevenueDataPoint> RevenueDataPoints => Set<RevenueDataPoint>();
    public DbSet<DevelopmentMilestone> DevelopmentMilestones => Set<DevelopmentMilestone>();
    public DbSet<UserNotification> UserNotifications => Set<UserNotification>();
    public DbSet<AccessControlSettings> AccessControlSettings => Set<AccessControlSettings>();
    public DbSet<RevMgmtCompanyConfig> RevMgmtCompanyConfigs => Set<RevMgmtCompanyConfig>();
    public DbSet<VendorProduct> VendorProducts => Set<VendorProduct>();
    public DbSet<QuoteRequest> QuoteRequests => Set<QuoteRequest>();
    public DbSet<QuoteRequestVendor> QuoteRequestVendors => Set<QuoteRequestVendor>();
    public DbSet<QuoteRequestLine> QuoteRequestLines => Set<QuoteRequestLine>();
    public DbSet<SampleRequest> SampleRequests => Set<SampleRequest>();
    public DbSet<DevQaRun> DevQaRuns => Set<DevQaRun>();
    public DbSet<TenantConnection> TenantConnections => Set<TenantConnection>();
    public DbSet<WastageEntry> WastageEntries => Set<WastageEntry>();
    public DbSet<TransferEntry> TransferEntries => Set<TransferEntry>();

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
        modelBuilder.Entity<Vendor>(e =>
        {
            e.HasIndex(v => new { v.CompanyId, v.ExternalId }).IsUnique();
            e.HasIndex(v => v.CompanyId);
        });
        modelBuilder.Entity<B2bCustomer>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.Property(x => x.Active).HasConversion<int>();
        });
        modelBuilder.Entity<PosCustomer>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.Property(x => x.Active).HasConversion<int>();
        });
        modelBuilder.Entity<Ingredient>(e =>
        {
            e.Property(x => x.ComponentId).HasMaxLength(32);
            e.Property(x => x.Name).HasMaxLength(200);
            e.HasIndex(x => new { x.CompanyId, x.ComponentId }).IsUnique();
            e.HasIndex(x => new { x.CompanyId, x.Name }).IsUnique();
            e.HasIndex(x => x.CompanyId);
        });
        modelBuilder.Entity<TenantConnection>(e =>
        {
            e.HasIndex(x => x.CompanyId).IsUnique();
            e.Property(x => x.DatabaseName).HasMaxLength(128);
            e.Property(x => x.ConnectionString).HasMaxLength(2000);
        });
        modelBuilder.Entity<WastageEntry>(e =>
        {
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.WastedDate });
            e.HasIndex(x => x.LocationExternalId);
            e.Property(x => x.Source).HasMaxLength(20);
            e.Property(x => x.ItemType).HasMaxLength(30);
            e.Property(x => x.ItemKey).HasMaxLength(80);
            e.Property(x => x.ItemName).HasMaxLength(200);
            e.Property(x => x.Uom).HasMaxLength(50);
            e.Property(x => x.Reason).HasMaxLength(300);
            e.Property(x => x.PosCheckNo).HasMaxLength(80);
            e.Property(x => x.LocationExternalId).HasMaxLength(100);
        });
        modelBuilder.Entity<TransferEntry>(e =>
        {
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.TransferDate });
            e.HasIndex(x => x.FromLocationExternalId);
            e.HasIndex(x => x.ToLocationExternalId);
            e.Property(x => x.ItemType).HasMaxLength(30);
            e.Property(x => x.ItemKey).HasMaxLength(80);
            e.Property(x => x.ItemName).HasMaxLength(200);
            e.Property(x => x.Uom).HasMaxLength(50);
            e.Property(x => x.FromLocationExternalId).HasMaxLength(100);
            e.Property(x => x.ToLocationExternalId).HasMaxLength(100);
        });
        modelBuilder.Entity<PurchaseOrder>().HasIndex(p => p.PoNumber).IsUnique();
        modelBuilder.Entity<PurchaseOrder>()
            .HasMany(p => p.Items)
            .WithOne(i => i.PurchaseOrder)
            .HasForeignKey(i => i.PurchaseOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<QuoteRequest>()
            .HasMany(q => q.Vendors)
            .WithOne(v => v.QuoteRequest)
            .HasForeignKey(v => v.QuoteRequestId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<QuoteRequest>()
            .HasMany(q => q.Lines)
            .WithOne(l => l.QuoteRequest)
            .HasForeignKey(l => l.QuoteRequestId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<QuoteRequestVendor>()
            .HasIndex(v => v.ShareToken);
        modelBuilder.Entity<QuoteRequest>()
            .HasIndex(q => q.RfqNumber);

        modelBuilder.Entity<SampleRequest>()
            .HasIndex(s => s.RequestNumber);
        modelBuilder.Entity<SampleRequest>()
            .HasIndex(s => s.CompanyId);
        modelBuilder.Entity<SampleRequest>()
            .HasIndex(s => s.ShareToken);

        modelBuilder.Entity<OrderTemplate>()
            .HasMany(t => t.Items)
            .WithOne(i => i.OrderTemplate)
            .HasForeignKey(i => i.OrderTemplateId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Product>(e =>
        {
            e.Property(x => x.ProductId).HasMaxLength(32);
            e.HasIndex(x => x.ProductId).IsUnique();
        });
        modelBuilder.Entity<Product>()
            .HasMany(p => p.Items)
            .WithOne(i => i.Product)
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Product>()
            .HasMany(p => p.Aliases)
            .WithOne(a => a.Product)
            .HasForeignKey(a => a.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Product>()
            .HasMany(p => p.PackagingItems)
            .WithOne(i => i.Product)
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ProductB2bLocationStock>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.LocationExternalId }).IsUnique();
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<B2bSalesOrder>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.OrderNumber }).IsUnique();
            e.HasMany(x => x.Lines)
                .WithOne(x => x.SalesOrder)
                .HasForeignKey(x => x.SalesOrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<B2bSalesOrderLine>(e =>
        {
            e.HasOne(x => x.SalesOrder)
                .WithMany(x => x.Lines)
                .HasForeignKey(x => x.SalesOrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<InventoryMovement>().HasIndex(m => new { m.ComponentId, m.LocationExternalId });
        modelBuilder.Entity<InventoryPurchase>().HasIndex(i => i.PurchaseOrderItemId);
        modelBuilder.Entity<InventoryCountSession>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.SessionType, x.PeriodMonth, x.Status });
            e.HasMany(x => x.Lines)
                .WithOne(x => x.Session)
                .HasForeignKey(x => x.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<InventoryCountSessionLine>().HasIndex(x => x.SessionId);
        modelBuilder.Entity<VendorProductPrice>().HasKey(p => p.ExternalId);
        modelBuilder.Entity<VendorProduct>().HasKey(p => p.ExternalId);
        modelBuilder.Entity<RevMgmtCompanyConfig>()
            .HasIndex(c => new { c.CompanyId, c.ConfigKey })
            .IsUnique();
    }
}
