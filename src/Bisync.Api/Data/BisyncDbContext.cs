using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Data;

public class BisyncDbContext(DbContextOptions<BisyncDbContext> options) : DbContext(options)
{
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<DeliveryLocation> DeliveryLocations => Set<DeliveryLocation>();
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
    public DbSet<VendorRating> VendorRatings => Set<VendorRating>();
    public DbSet<B2bCustomer> B2bCustomers => Set<B2bCustomer>();
    public DbSet<PosCustomer> PosCustomers => Set<PosCustomer>();
    public DbSet<PosOpenCheck> PosOpenChecks => Set<PosOpenCheck>();
    public DbSet<PosClosedCheck> PosClosedChecks => Set<PosClosedCheck>();
    public DbSet<PosPayment> PosPayments => Set<PosPayment>();
    public DbSet<PosVoid> PosVoids => Set<PosVoid>();
    public DbSet<PosCancel> PosCancels => Set<PosCancel>();
    public DbSet<PosEodSession> PosEodSessions => Set<PosEodSession>();
    public DbSet<PosSaleDetail> PosSaleDetails => Set<PosSaleDetail>();
    public DbSet<SalesModuleCustomer> SalesModuleCustomers => Set<SalesModuleCustomer>();
    public DbSet<SalesModuleAppointment> SalesModuleAppointments => Set<SalesModuleAppointment>();
    public DbSet<SalesModuleCalendarSettings> SalesModuleCalendarSettings => Set<SalesModuleCalendarSettings>();
    public DbSet<SalesModuleTeamMember> SalesModuleTeamMembers => Set<SalesModuleTeamMember>();
    public DbSet<SalesModuleCompany> SalesModuleCompanies => Set<SalesModuleCompany>();
    public DbSet<SalesModuleCompanyMember> SalesModuleCompanyMembers => Set<SalesModuleCompanyMember>();
    public DbSet<SalesModuleClientUpdate> SalesModuleClientUpdates => Set<SalesModuleClientUpdate>();
    public DbSet<SalesModuleDiaryEntry> SalesModuleDiaryEntries => Set<SalesModuleDiaryEntry>();
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
    public DbSet<ProductBomChange> ProductBomChanges => Set<ProductBomChange>();
    public DbSet<ProductFieldChange> ProductFieldChanges => Set<ProductFieldChange>();
    public DbSet<NutritionLibraryFood> NutritionLibraryFoods => Set<NutritionLibraryFood>();
    public DbSet<NutritionLibraryMeta> NutritionLibraryMeta => Set<NutritionLibraryMeta>();
    public DbSet<ProductNutrientEstimate> ProductNutrientEstimates => Set<ProductNutrientEstimate>();
    public DbSet<ProductB2bLocationStock> ProductB2bLocationStocks => Set<ProductB2bLocationStock>();
    public DbSet<B2bSalesOrder> B2bSalesOrders => Set<B2bSalesOrder>();
    public DbSet<B2bSalesOrderLine> B2bSalesOrderLines => Set<B2bSalesOrderLine>();
    public DbSet<DeliveryOrder> DeliveryOrders => Set<DeliveryOrder>();
    public DbSet<DeliveryOrderLine> DeliveryOrderLines => Set<DeliveryOrderLine>();
    public DbSet<Promotion> Promotions => Set<Promotion>();
    public DbSet<PromotionProduct> PromotionProducts => Set<PromotionProduct>();
    public DbSet<PosPromotion> PosPromotions => Set<PosPromotion>();
    public DbSet<PosPromotionProduct> PosPromotionProducts => Set<PosPromotionProduct>();
    public DbSet<PosProductMapping> PosProductMappings => Set<PosProductMapping>();
    public DbSet<PosPrepaidPurchase> PosPrepaidPurchases => Set<PosPrepaidPurchase>();
    public DbSet<PosPrepaidLedger> PosPrepaidLedgers => Set<PosPrepaidLedger>();
    public DbSet<PosDevice> PosDevices => Set<PosDevice>();
    public DbSet<PosDeviceSetupRule> PosDeviceSetupRules => Set<PosDeviceSetupRule>();
    public DbSet<PosModifierGroup> PosModifierGroups => Set<PosModifierGroup>();
    public DbSet<PosModifierOption> PosModifierOptions => Set<PosModifierOption>();
    public DbSet<PosModifierAttachment> PosModifierAttachments => Set<PosModifierAttachment>();
    public DbSet<PosConfigType> PosConfigTypes => Set<PosConfigType>();
    public DbSet<PosTaxServiceConfig> PosTaxServiceConfigs => Set<PosTaxServiceConfig>();
    public DbSet<PosFloorPlan> PosFloorPlans => Set<PosFloorPlan>();
    public DbSet<PosFloorPlanVersion> PosFloorPlanVersions => Set<PosFloorPlanVersion>();
    public DbSet<PosWaitlistEntry> PosWaitlistEntries => Set<PosWaitlistEntry>();
    public DbSet<PosQrOrder> PosQrOrders => Set<PosQrOrder>();
    public DbSet<PosPrinterSdk> PosPrinterSdks => Set<PosPrinterSdk>();
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
    public DbSet<PlatformLaunchSettings> PlatformLaunchSettings => Set<PlatformLaunchSettings>();
    public DbSet<PlatformPriceDisplaySettings> PlatformPriceDisplaySettings => Set<PlatformPriceDisplaySettings>();
    public DbSet<RevMgmtCompanyConfig> RevMgmtCompanyConfigs => Set<RevMgmtCompanyConfig>();
    public DbSet<VendorProduct> VendorProducts => Set<VendorProduct>();
    public DbSet<QuoteRequest> QuoteRequests => Set<QuoteRequest>();
    public DbSet<QuoteRequestVendor> QuoteRequestVendors => Set<QuoteRequestVendor>();
    public DbSet<QuoteRequestLine> QuoteRequestLines => Set<QuoteRequestLine>();
    public DbSet<SampleRequest> SampleRequests => Set<SampleRequest>();
    public DbSet<DevQaRun> DevQaRuns => Set<DevQaRun>();
    public DbSet<DevTeamUser> DevTeamUsers => Set<DevTeamUser>();
    public DbSet<DevConsoleSession> DevConsoleSessions => Set<DevConsoleSession>();
    public DbSet<DevConsolePasswordTicket> DevConsolePasswordTickets => Set<DevConsolePasswordTicket>();
    public DbSet<TenantConnection> TenantConnections => Set<TenantConnection>();
    public DbSet<TenantRollupSnapshot> TenantRollupSnapshots => Set<TenantRollupSnapshot>();
    public DbSet<GlAccount> GlAccounts => Set<GlAccount>();
    public DbSet<GlFiscalPeriod> GlFiscalPeriods => Set<GlFiscalPeriod>();
    public DbSet<GlJournal> GlJournals => Set<GlJournal>();
    public DbSet<GlJournalLine> GlJournalLines => Set<GlJournalLine>();
    public DbSet<GlPeriodBalance> GlPeriodBalances => Set<GlPeriodBalance>();
    public DbSet<GlDocCounter> GlDocCounters => Set<GlDocCounter>();
    public DbSet<GlOutboxMessage> GlOutboxMessages => Set<GlOutboxMessage>();
    public DbSet<LocationSubscription> LocationSubscriptions => Set<LocationSubscription>();
    public DbSet<WastageEntry> WastageEntries => Set<WastageEntry>();
    public DbSet<TransferEntry> TransferEntries => Set<TransferEntry>();
    public DbSet<ReturnableGoodsReturn> ReturnableGoodsReturns => Set<ReturnableGoodsReturn>();
    public DbSet<CreditNote> CreditNotes => Set<CreditNote>();
    public DbSet<CentralStoreConfig> CentralStoreConfigs => Set<CentralStoreConfig>();
    public DbSet<StoreRequisition> StoreRequisitions => Set<StoreRequisition>();
    public DbSet<StoreRequisitionLine> StoreRequisitionLines => Set<StoreRequisitionLine>();
    public DbSet<ProductionStockHold> ProductionStockHolds => Set<ProductionStockHold>();
    public DbSet<TeamConversation> TeamConversations => Set<TeamConversation>();
    public DbSet<TeamConversationMember> TeamConversationMembers => Set<TeamConversationMember>();
    public DbSet<TeamChatMessage> TeamChatMessages => Set<TeamChatMessage>();
    public DbSet<TeamProjectTask> TeamProjectTasks => Set<TeamProjectTask>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DeliveryLocation>(e =>
        {
            e.HasIndex(d => d.ExternalId).IsUnique();
            e.HasIndex(d => new { d.LocationExternalId, d.Active });
            e.HasIndex(d => new { d.CompanyId, d.Active });
        });
        modelBuilder.Entity<Location>(e =>
        {
            e.HasIndex(l => l.ExternalId).IsUnique();
            e.Property(x => x.Active).HasConversion<int>();
            e.HasOne(l => l.Company)
                .WithMany(c => c.Locations)
                .HasForeignKey(l => l.CompanyId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(l => l.PrincipalContact)
                .WithMany()
                .HasForeignKey(l => l.PrincipalContactUserId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(l => l.SecondaryContact)
                .WithMany()
                .HasForeignKey(l => l.SecondaryContactUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });
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
        modelBuilder.Entity<VendorRating>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.VendorExternalId });
            e.HasIndex(x => x.VendorExternalId);
            e.Property(x => x.VendorExternalId).HasMaxLength(64);
            e.Property(x => x.Delivery).HasMaxLength(32);
            e.Property(x => x.ProductAccuracy).HasMaxLength(32);
            e.Property(x => x.ProductQuality).HasMaxLength(32);
            e.Property(x => x.HygieneCleanliness).HasMaxLength(32);
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
        modelBuilder.Entity<PosOpenCheck>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId });
            e.HasIndex(x => new { x.CompanyId, x.CheckNumber });
            e.Property(x => x.Active).HasConversion<int>();
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.Dining).HasMaxLength(32);
            e.Property(x => x.TableLabel).HasMaxLength(64);
            e.Property(x => x.TakeoutCallLabel).HasMaxLength(128);
        });
        modelBuilder.Entity<PosClosedCheck>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.PaidAt });
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.CheckLabel).HasMaxLength(32);
        });
        modelBuilder.Entity<PosPayment>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.PaidAt });
            e.HasIndex(x => new { x.CompanyId, x.Method });
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.Method).HasMaxLength(40);
            e.Property(x => x.Purpose).HasMaxLength(240);
            e.Property(x => x.CardIin).HasMaxLength(8);
            e.Property(x => x.CardIssuer).HasMaxLength(64);
            e.Property(x => x.CardLast4).HasMaxLength(4);
            e.Property(x => x.CardMii).HasMaxLength(2);
            e.Property(x => x.CardMiiLabel).HasMaxLength(80);
        });
        modelBuilder.Entity<PosVoid>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.VoidedAt });
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.Reason).HasMaxLength(500);
            e.Property(x => x.AuthorizedBy).HasMaxLength(120);
        });
        modelBuilder.Entity<PosCancel>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.CanceledAt });
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.Reason).HasMaxLength(500);
            e.Property(x => x.CanceledBy).HasMaxLength(120);
        });
        modelBuilder.Entity<PosSaleDetail>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.CreatedAt });
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.CreatedAt });
            e.Property(x => x.ProductCode).HasMaxLength(80);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.LocationExternalId).HasMaxLength(120);
            e.Property(x => x.SalesChannel).HasMaxLength(20);
            e.Property(x => x.VariableMode).HasMaxLength(40);
            e.Property(x => x.WeightUom).HasMaxLength(40);
        });
        modelBuilder.Entity<PosEodSession>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.BusinessDate }).IsUnique();
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.CashConfirmed).HasConversion<int>();
            e.Property(x => x.CreditQrConfirmed).HasConversion<int>();
            e.Property(x => x.NonRevenueConfirmed).HasConversion<int>();
            e.Property(x => x.VoidsConfirmed).HasConversion<int>();
            e.Property(x => x.DiscountConfirmed).HasConversion<int>();
            e.Property(x => x.DayClosed).HasConversion<int>();
        });
        modelBuilder.Entity<PosFloorPlan>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId }).IsUnique();
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
        });
        modelBuilder.Entity<PosFloorPlanVersion>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.CapturedAt });
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.Source).HasMaxLength(40);
        });
        modelBuilder.Entity<PosWaitlistEntry>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.Status });
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.Name).HasMaxLength(120);
            e.Property(x => x.Mobile).HasMaxLength(40);
            e.Property(x => x.Status).HasMaxLength(24);
        });
        modelBuilder.Entity<PosQrOrder>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.Status });
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.TableLabel).HasMaxLength(64);
            e.Property(x => x.GuestName).HasMaxLength(120);
            e.Property(x => x.Status).HasMaxLength(24);
        });
        modelBuilder.Entity<SalesModuleCustomer>(e =>
        {
            e.HasIndex(x => x.ExternalId).IsUnique();
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.EngagedUserId });
            e.Property(x => x.Active).HasConversion<int>();
            e.Property(x => x.CompanyName).HasMaxLength(200);
            e.Property(x => x.Status).HasMaxLength(40);
            e.Property(x => x.EngagedUserEmail).HasMaxLength(256);
            e.Property(x => x.EngagedUserName).HasMaxLength(200);
            e.Property(x => x.HunterName).HasMaxLength(200);
            e.Property(x => x.FarmerName).HasMaxLength(200);
        });
        modelBuilder.Entity<SalesModuleAppointment>(e =>
        {
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.StartsAt });
            e.HasIndex(x => x.SalesModuleCustomerId);
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Location).HasMaxLength(200);
            e.Property(x => x.EngagedUserEmail).HasMaxLength(256);
            e.Property(x => x.OutlookEventId).HasMaxLength(256);
            e.Property(x => x.OutlookWebLink).HasMaxLength(1024);
            e.Property(x => x.OutlookSyncError).HasMaxLength(500);
        });
        modelBuilder.Entity<SalesModuleCalendarSettings>(e =>
        {
            e.Property(x => x.GraphTenantId).HasMaxLength(64);
            e.Property(x => x.GraphClientId).HasMaxLength(64);
            e.Property(x => x.GraphClientSecret).HasMaxLength(512);
            e.Property(x => x.CalendarMailbox).HasMaxLength(256);
            e.Property(x => x.CalendarDisplayName).HasMaxLength(120);
            e.Property(x => x.UpdatedByEmail).HasMaxLength(256);
            e.Property(x => x.LastTestAt).HasMaxLength(64);
            e.Property(x => x.LastTestResult).HasMaxLength(500);
        });
        modelBuilder.Entity<SalesModuleTeamMember>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(256);
            e.Property(x => x.LastSyncError).HasMaxLength(500);
        });
        modelBuilder.Entity<SalesModuleCompany>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.CreatedByEmail).HasMaxLength(256);
            e.HasIndex(x => x.Name);
        });
        modelBuilder.Entity<SalesModuleCompanyMember>(e =>
        {
            e.HasIndex(x => new { x.SalesModuleCompanyId, x.SalesTeamMemberId }).IsUnique();
            e.HasIndex(x => x.SalesTeamMemberId);
        });
        modelBuilder.Entity<SalesModuleClientUpdate>(e =>
        {
            e.HasIndex(x => x.Hunter);
            e.HasIndex(x => x.DateCreated);
            e.HasIndex(x => x.SalesTeamMemberId);
            e.Property(x => x.Hunter).HasMaxLength(120);
            e.Property(x => x.Company).HasMaxLength(200);
            e.Property(x => x.Brand).HasMaxLength(200);
            e.Property(x => x.Status).HasMaxLength(80);
            e.Property(x => x.ContactPerson).HasMaxLength(200);
            e.Property(x => x.ContactType).HasMaxLength(120);
            e.Property(x => x.Note).HasMaxLength(4000);
            e.Property(x => x.Appointment).HasMaxLength(500);
        });
        modelBuilder.Entity<SalesModuleDiaryEntry>(e =>
        {
            e.HasIndex(x => x.SalesTeamMemberId);
            e.HasIndex(x => x.ContactDate);
            e.HasIndex(x => x.SalesModuleCompanyId);
            e.Property(x => x.ActivityType).HasMaxLength(40);
            e.Property(x => x.CompanyName).HasMaxLength(200);
            e.Property(x => x.BrandName).HasMaxLength(200);
            e.Property(x => x.LocationVisited).HasMaxLength(300);
            e.Property(x => x.ContactType).HasMaxLength(80);
            e.Property(x => x.CreatedByEmail).HasMaxLength(256);
        });
        modelBuilder.Entity<Company>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(4);
            e.Property(x => x.SmtpProviderMode).HasMaxLength(32);
            e.Property(x => x.SmtpHost).HasMaxLength(256);
            e.Property(x => x.SmtpUsername).HasMaxLength(256);
            e.Property(x => x.SmtpPassword).HasMaxLength(512);
            e.Property(x => x.SmtpFromEmail).HasMaxLength(256);
            e.Property(x => x.SmtpFromName).HasMaxLength(256);
            e.Property(x => x.GraphTenantId).HasMaxLength(64);
            e.Property(x => x.GraphClientId).HasMaxLength(64);
            e.Property(x => x.GraphClientSecret).HasMaxLength(512);
        });
        modelBuilder.Entity<Ingredient>(e =>
        {
            e.Property(x => x.ComponentId).HasMaxLength(32);
            e.Property(x => x.Name).HasMaxLength(200);
            e.HasIndex(x => new { x.CompanyId, x.ComponentId }).IsUnique();
            // Exact Name uniqueness is enforced by SQL index on LOWER("Name") for space/case normalization.
            e.HasIndex(x => x.CompanyId);
        });
        modelBuilder.Entity<TenantConnection>(e =>
        {
            e.HasIndex(x => x.CompanyId).IsUnique();
            e.Property(x => x.DatabaseName).HasMaxLength(128);
            e.Property(x => x.ConnectionString).HasMaxLength(2000);
            e.Property(x => x.ArchiveDatabaseName).HasMaxLength(128);
            e.Property(x => x.ArchiveConnectionString).HasMaxLength(2000);
        });
        modelBuilder.Entity<WastageEntry>(e =>
        {
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.WastedDate });
            e.HasIndex(x => x.LocationExternalId);
            e.HasIndex(x => new { x.SourceReferenceType, x.SourceReferenceId, x.SplitUseLineKey });
            e.Property(x => x.Source).HasMaxLength(20);
            e.Property(x => x.ItemType).HasMaxLength(30);
            e.Property(x => x.ItemKey).HasMaxLength(80);
            e.Property(x => x.ItemName).HasMaxLength(200);
            e.Property(x => x.Uom).HasMaxLength(50);
            e.Property(x => x.Reason).HasMaxLength(300);
            e.Property(x => x.PosCheckNo).HasMaxLength(80);
            e.Property(x => x.LocationExternalId).HasMaxLength(100);
            e.Property(x => x.SourceReferenceType).HasMaxLength(40);
            e.Property(x => x.SplitUseLineKey).HasMaxLength(100);
        });
        modelBuilder.Entity<CreditNote>(e =>
        {
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.CreditNoteDate });
            e.HasIndex(x => x.PurchaseOrderId);
            e.HasIndex(x => x.PurchaseOrderItemId);
            e.HasIndex(x => x.Status);
            e.Property(x => x.LocationExternalId).HasMaxLength(100);
            e.Property(x => x.CreditNoteNumber).HasMaxLength(80);
            e.Property(x => x.PoNumber).HasMaxLength(80);
            e.Property(x => x.VendorExternalId).HasMaxLength(80);
            e.Property(x => x.VendorName).HasMaxLength(200);
            e.Property(x => x.VendorProductId).HasMaxLength(80);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.ComponentId).HasMaxLength(80);
            e.Property(x => x.ComponentName).HasMaxLength(200);
            e.Property(x => x.DeliveryUom).HasMaxLength(50);
            e.Property(x => x.StockUom).HasMaxLength(50);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.CancelPoNumber).HasMaxLength(80);
            e.Property(x => x.CancelDoOrInvoiceNumber).HasMaxLength(120);
            e.Property(x => x.CancelledBy).HasMaxLength(200);
        });
        modelBuilder.Entity<CentralStoreConfig>(e =>
        {
            e.HasIndex(x => x.CompanyId).IsUnique();
            e.Property(x => x.StoreLocationExternalId).HasMaxLength(100);
            e.Property(x => x.KitchenLocationExternalId).HasMaxLength(100);
        });
        modelBuilder.Entity<StoreRequisition>(e =>
        {
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => x.Kind);
            e.HasIndex(x => x.ProductId);
            e.Property(x => x.RequisitionNumber).HasMaxLength(40);
            e.Property(x => x.Kind).HasMaxLength(20);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.StoreLocationExternalId).HasMaxLength(100);
            e.Property(x => x.KitchenLocationExternalId).HasMaxLength(100);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.RequestedBy).HasMaxLength(200);
            e.Property(x => x.IssuedBy).HasMaxLength(200);
            e.Property(x => x.ReceivedBy).HasMaxLength(200);
            e.HasMany(x => x.Lines)
                .WithOne(l => l.StoreRequisition)
                .HasForeignKey(l => l.StoreRequisitionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<StoreRequisitionLine>(e =>
        {
            e.HasIndex(x => x.StoreRequisitionId);
            e.Property(x => x.ComponentId).HasMaxLength(80);
            e.Property(x => x.ComponentName).HasMaxLength(200);
            e.Property(x => x.Uom).HasMaxLength(50);
        });
        modelBuilder.Entity<ProductionStockHold>(e =>
        {
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.Status });
            e.HasIndex(x => x.LocationExternalId);
            e.HasIndex(x => x.ProductId);
            e.HasIndex(x => x.StoreRequisitionId);
            e.Property(x => x.LocationExternalId).HasMaxLength(100);
            e.Property(x => x.ComponentId).HasMaxLength(80);
            e.Property(x => x.ComponentName).HasMaxLength(200);
            e.Property(x => x.Uom).HasMaxLength(50);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.Status).HasMaxLength(20);
        });
        modelBuilder.Entity<TransferEntry>(e =>
        {
            e.HasIndex(x => x.CompanyId);
            e.HasIndex(x => new { x.CompanyId, x.TransferDate });
            e.HasIndex(x => new { x.Status, x.ToLocationExternalId });
            e.HasIndex(x => x.FromLocationExternalId);
            e.HasIndex(x => x.ToLocationExternalId);
            e.Property(x => x.ItemType).HasMaxLength(30);
            e.Property(x => x.ItemKey).HasMaxLength(80);
            e.Property(x => x.ItemName).HasMaxLength(200);
            e.Property(x => x.Uom).HasMaxLength(50);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.InitiatedBy).HasMaxLength(200);
            e.Property(x => x.ReceivedBy).HasMaxLength(200);
            e.Property(x => x.RejectedBy).HasMaxLength(200);
            e.Property(x => x.FromLocationExternalId).HasMaxLength(100);
            e.Property(x => x.ToLocationExternalId).HasMaxLength(100);
        });
        modelBuilder.Entity<PurchaseOrder>().HasIndex(p => p.PoNumber).IsUnique();
        // Legacy tenant DBs store VendorAcceptExpiryDate as TEXT; Npgsql cannot read DateOnly
        // from text. Convert via string so both text and date columns work.
        modelBuilder.Entity<PurchaseOrder>()
            .Property(p => p.VendorAcceptExpiryDate)
            .HasConversion(
                v => v.HasValue ? v.Value.ToString("yyyy-MM-dd") : null,
                v => ParseOptionalDateOnly(v));
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
        modelBuilder.Entity<ProductBomChange>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.ChangedAt });
            e.HasIndex(x => new { x.CompanyId, x.ChangedAt });
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<ProductFieldChange>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.ChangedAt });
            e.HasIndex(x => new { x.CompanyId, x.ChangedAt });
            e.Property(x => x.FieldName).HasMaxLength(80);
            e.Property(x => x.FieldLabel).HasMaxLength(120);
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<NutritionLibraryFood>(e =>
        {
            e.HasIndex(x => x.FdcId).IsUnique();
            e.HasIndex(x => x.NormalizedName);
            e.HasIndex(x => x.Source);
            e.Property(x => x.Source).HasMaxLength(40);
            e.Property(x => x.Description).HasMaxLength(400);
            e.Property(x => x.NormalizedName).HasMaxLength(400);
            e.Property(x => x.NdbNumber).HasMaxLength(40);
        });
        modelBuilder.Entity<NutritionLibraryMeta>(e =>
        {
            e.Property(x => x.Version).HasMaxLength(80);
            e.Property(x => x.LastSyncStatus).HasMaxLength(40);
        });
        modelBuilder.Entity<ProductNutrientEstimate>(e =>
        {
            e.HasKey(x => x.ProductId);
            e.HasIndex(x => x.LibraryVersion);
            e.HasOne(x => x.Product)
                .WithOne()
                .HasForeignKey<ProductNutrientEstimate>(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<ProductB2bLocationStock>(e =>
        {
            e.HasIndex(x => new { x.ProductId, x.LocationExternalId }).IsUnique();
            e.HasOne(x => x.Product)
                .WithMany()
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<Promotion>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.Active });
            e.HasIndex(x => new { x.CompanyId, x.StartDate });
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.DurationMode).HasMaxLength(20);
            e.Property(x => x.PromotionType).HasMaxLength(40);
            e.Property(x => x.CreatedBy).HasMaxLength(256);
            e.HasMany(x => x.Products)
                .WithOne(x => x.Promotion)
                .HasForeignKey(x => x.PromotionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<PromotionProduct>(e =>
        {
            e.HasIndex(x => new { x.PromotionId, x.ProductId }).IsUnique();
            e.HasIndex(x => x.ProductId);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.DeliveryUnit).HasMaxLength(80);
        });
        modelBuilder.Entity<PosPromotion>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.Active });
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.RepeatMode).HasMaxLength(20);
            e.Property(x => x.PromoType).HasMaxLength(40);
            e.Property(x => x.PromotionKind).HasMaxLength(40);
            e.Property(x => x.ValidityPeriodUnit).HasMaxLength(20);
            e.Property(x => x.PackageUom).HasMaxLength(40);
            e.Property(x => x.DepletionMethod).HasMaxLength(40);
            e.Property(x => x.CreatedBy).HasMaxLength(256);
            e.Property(x => x.FilterCategory).HasMaxLength(100);
            e.Property(x => x.FilterGroup).HasMaxLength(100);
            e.HasMany(x => x.Products)
                .WithOne(x => x.PosPromotion)
                .HasForeignKey(x => x.PosPromotionId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<PosPromotionProduct>(e =>
        {
            e.HasIndex(x => new { x.PosPromotionId, x.ProductId }).IsUnique();
            e.HasIndex(x => x.ProductId);
            e.Property(x => x.ProductCode).HasMaxLength(80);
            e.Property(x => x.ProductName).HasMaxLength(200);
        });
        modelBuilder.Entity<PosProductMapping>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.ProductId }).IsUnique();
            e.HasIndex(x => new { x.CompanyId, x.PluNumber }).IsUnique();
            e.HasIndex(x => new { x.CompanyId, x.Active });
            e.Property(x => x.ProductCode).HasMaxLength(80);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.PluNumber).HasMaxLength(80);
        });
        modelBuilder.Entity<PosPrepaidPurchase>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.CustomerMobile });
            e.HasIndex(x => x.PosPromotionId);
            e.HasIndex(x => x.Status);
            e.HasIndex(x => new { x.CompanyId, x.Status });
            e.Property(x => x.LocationExternalId).HasMaxLength(120);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.CustomerName).HasMaxLength(200);
            e.Property(x => x.CustomerMobile).HasMaxLength(40);
            e.Property(x => x.PackageUom).HasMaxLength(40);
            e.Property(x => x.Status).HasMaxLength(20);
            e.HasMany(x => x.LedgerEntries)
                .WithOne(x => x.PosPrepaidPurchase)
                .HasForeignKey(x => x.PosPrepaidPurchaseId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<PosPrepaidLedger>(e =>
        {
            e.HasIndex(x => x.PosPrepaidPurchaseId);
            e.Property(x => x.EntryType).HasMaxLength(20);
            e.Property(x => x.UnitCode).HasMaxLength(40);
            e.Property(x => x.UnitLabel).HasMaxLength(80);
            e.Property(x => x.LocationExternalId).HasMaxLength(120);
            e.Property(x => x.CreatedBy).HasMaxLength(256);
        });
        modelBuilder.Entity<PosDevice>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.Active });
            e.HasIndex(x => new { x.CompanyId, x.DeviceType });
            e.Property(x => x.LocationExternalId).HasMaxLength(120);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.DeviceType).HasMaxLength(40);
            e.Property(x => x.ConnectionType).HasMaxLength(40);
            e.Property(x => x.HostAddress).HasMaxLength(120);
            e.Property(x => x.MacAddress).HasMaxLength(40);
            e.Property(x => x.PrinterSdkCode).HasMaxLength(80);
            e.Property(x => x.PrinterBrand).HasMaxLength(80);
            e.Property(x => x.PrinterModel).HasMaxLength(120);
            e.Property(x => x.PrintAlignment).HasMaxLength(20);
            e.Property(x => x.CreatedBy).HasMaxLength(256);
        });
        modelBuilder.Entity<PosDeviceSetupRule>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId, x.Active });
            e.HasIndex(x => new { x.CompanyId, x.ProductId });
            e.Property(x => x.LocationExternalId).HasMaxLength(120);
            e.Property(x => x.ProductCategory).HasMaxLength(120);
            e.Property(x => x.ProductGroup).HasMaxLength(120);
            e.Property(x => x.ProductName).HasMaxLength(200);
            e.Property(x => x.PrimaryDeviceType).HasMaxLength(80);
            e.Property(x => x.SecondaryDeviceType).HasMaxLength(80);
            e.Property(x => x.ConcurrentDeviceType).HasMaxLength(80);
        });
        modelBuilder.Entity<PosModifierGroup>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.Kind, x.Active });
            e.Property(x => x.Kind).HasMaxLength(40);
            e.Property(x => x.Name).HasMaxLength(200);
            e.HasMany(x => x.Options)
                .WithOne(x => x.PosModifierGroup)
                .HasForeignKey(x => x.PosModifierGroupId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Attachments)
                .WithOne(x => x.PosModifierGroup)
                .HasForeignKey(x => x.PosModifierGroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<PosModifierOption>(e =>
        {
            e.HasIndex(x => x.PosModifierGroupId);
            e.Property(x => x.Label).HasMaxLength(200);
            e.Property(x => x.LinkedProductName).HasMaxLength(200);
            e.Property(x => x.LinkedComponentId).HasMaxLength(80);
            e.Property(x => x.LinkedComponentName).HasMaxLength(200);
            e.Property(x => x.BaseComponentId).HasMaxLength(80);
            e.Property(x => x.BaseComponentName).HasMaxLength(200);
        });
        modelBuilder.Entity<PosModifierAttachment>(e =>
        {
            e.HasIndex(x => x.PosModifierGroupId);
            e.HasIndex(x => x.TargetProductId);
            e.Property(x => x.TargetType).HasMaxLength(40);
            e.Property(x => x.TargetProductCategory).HasMaxLength(120);
            e.Property(x => x.TargetProductGroup).HasMaxLength(120);
            e.Property(x => x.TargetProductName).HasMaxLength(200);
        });
        modelBuilder.Entity<PosConfigType>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.Kind, x.Code }).IsUnique();
            e.HasIndex(x => new { x.CompanyId, x.Kind, x.Active });
            e.Property(x => x.Kind).HasMaxLength(40);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Code).HasMaxLength(40);
            e.Property(x => x.ExceptionGroupsJson).HasColumnType("text");
            e.Property(x => x.ExceptionProductIdsJson).HasColumnType("text");
        });
        modelBuilder.Entity<PosTaxServiceConfig>(e =>
        {
            e.HasIndex(x => x.CompanyId).IsUnique();
            e.Property(x => x.ConfigJson).HasColumnType("text");
        });
        modelBuilder.Entity<PosPrinterSdk>(e =>
        {
            e.HasIndex(x => x.SdkCode).IsUnique();
            e.Property(x => x.SdkCode).HasMaxLength(80);
            e.Property(x => x.Brand).HasMaxLength(80);
            e.Property(x => x.DisplayName).HasMaxLength(160);
            e.Property(x => x.Protocol).HasMaxLength(40);
            e.Property(x => x.Version).HasMaxLength(40);
            e.Property(x => x.Platform).HasMaxLength(40);
            e.Property(x => x.PackageKind).HasMaxLength(40);
            e.Property(x => x.ExternalUrl).HasMaxLength(500);
            e.Property(x => x.ArtifactFolder).HasMaxLength(160);
        });
        modelBuilder.Entity<B2bSalesOrder>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.OrderNumber }).IsUnique();
            e.HasIndex(x => x.ShareToken);
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
        modelBuilder.Entity<InventoryPurchase>(e =>
        {
            e.HasIndex(i => i.PurchaseOrderItemId);
            e.HasIndex(i => new { i.SplitSourceType, i.SplitSourceId, i.SplitLineKey });
            e.Property(i => i.SplitSourceType).HasMaxLength(40);
            e.Property(i => i.SplitLineKey).HasMaxLength(100);
            e.Property(i => i.SplitParentComponentId).HasMaxLength(32);
        });
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
        modelBuilder.Entity<DevTeamUser>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
        });
        modelBuilder.Entity<DevConsoleSession>(e =>
        {
            e.HasIndex(x => x.Token).IsUnique();
            e.HasOne(x => x.DevTeamUser)
                .WithMany()
                .HasForeignKey(x => x.DevTeamUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<DevConsolePasswordTicket>(e =>
        {
            e.HasIndex(x => x.Ticket).IsUnique();
            e.HasOne(x => x.DevTeamUser)
                .WithMany()
                .HasForeignKey(x => x.DevTeamUserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<LocationSubscription>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.LocationExternalId }).IsUnique();
            e.Property(x => x.LocationExternalId).HasMaxLength(64);
            e.Property(x => x.Currency).HasMaxLength(8);
            e.Property(x => x.Amount).HasPrecision(18, 2);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.PaymentMethod).HasMaxLength(32);
            e.Property(x => x.PaymentReference).HasMaxLength(128);
            e.Property(x => x.BankName).HasMaxLength(128);
        });
        modelBuilder.Entity<TeamConversation>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.Type });
            e.Property(x => x.Type).HasMaxLength(32);
            e.Property(x => x.Title).HasMaxLength(200);
        });
        modelBuilder.Entity<TeamConversationMember>(e =>
        {
            e.HasIndex(x => new { x.ConversationId, x.EmployeeId }).IsUnique();
            e.HasOne(x => x.Conversation)
                .WithMany(c => c.Members)
                .HasForeignKey(x => x.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Employee)
                .WithMany()
                .HasForeignKey(x => x.EmployeeId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<TeamChatMessage>(e =>
        {
            e.HasIndex(x => new { x.ConversationId, x.CreatedAt });
            e.HasOne(x => x.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(x => x.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Sender)
                .WithMany()
                .HasForeignKey(x => x.SenderEmployeeId)
                .OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.AttachmentContentType).HasMaxLength(128);
        });
        modelBuilder.Entity<TeamProjectTask>(e =>
        {
            e.HasIndex(x => new { x.ConversationId, x.SortOrder });
            e.Property(x => x.Title).HasMaxLength(300);
            e.Property(x => x.AssigneeEmployeeIdsJson).HasMaxLength(2000);
            e.HasOne(x => x.Conversation)
                .WithMany(c => c.ProjectTasks)
                .HasForeignKey(x => x.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GlAccount>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.Code }).IsUnique();
            e.Property(x => x.Code).HasMaxLength(32);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.AccountType).HasMaxLength(32);
            e.Property(x => x.NormalBalance).HasMaxLength(1);
        });
        modelBuilder.Entity<GlFiscalPeriod>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.Year, x.PeriodNo }).IsUnique();
            e.Property(x => x.Status).HasMaxLength(24);
        });
        modelBuilder.Entity<GlJournal>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.DocSeries, x.FiscalYear, x.DocNumber })
                .IsUnique()
                .HasFilter("\"DocNumber\" IS NOT NULL");
            e.HasIndex(x => new { x.CompanyId, x.IdempotencyKey })
                .IsUnique()
                .HasFilter("\"IdempotencyKey\" IS NOT NULL");
            e.HasIndex(x => new { x.CompanyId, x.PostedAt });
            e.Property(x => x.LedgerKind).HasMaxLength(32);
            e.Property(x => x.JournalType).HasMaxLength(32);
            e.Property(x => x.DocSeries).HasMaxLength(32);
            e.Property(x => x.DocNumber).HasMaxLength(64);
            e.Property(x => x.SourceModule).HasMaxLength(32);
            e.Property(x => x.SourceDocKey).HasMaxLength(120);
            e.Property(x => x.IdempotencyKey).HasMaxLength(160);
            e.Property(x => x.CreatedBy).HasMaxLength(120);
            e.HasMany(x => x.Lines)
                .WithOne(x => x.Journal)
                .HasForeignKey(x => x.JournalId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Period)
                .WithMany()
                .HasForeignKey(x => x.PeriodId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<GlJournalLine>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.JournalId, x.LineNo }).IsUnique();
            e.HasIndex(x => new { x.CompanyId, x.AccountId, x.EffectiveDate });
            e.Property(x => x.Direction).HasMaxLength(1);
            e.Property(x => x.Currency).HasMaxLength(3);
            e.Property(x => x.FuncCurrency).HasMaxLength(3);
            e.HasOne(x => x.Account)
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<GlPeriodBalance>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.AccountId, x.PeriodId, x.Currency }).IsUnique();
            e.Property(x => x.Currency).HasMaxLength(3);
        });
        modelBuilder.Entity<GlDocCounter>(e =>
        {
            e.HasKey(x => new { x.CompanyId, x.Series, x.FiscalYear });
            e.Property(x => x.Series).HasMaxLength(32);
        });
        modelBuilder.Entity<GlOutboxMessage>(e =>
        {
            e.HasIndex(x => new { x.CompanyId, x.IdempotencyKey })
                .IsUnique()
                .HasFilter("\"IdempotencyKey\" IS NOT NULL");
            e.HasIndex(x => new { x.CompanyId, x.CreatedAt });
            e.Property(x => x.EventType).HasMaxLength(80);
            e.Property(x => x.IdempotencyKey).HasMaxLength(160);
        });
    }

    static DateOnly? ParseOptionalDateOnly(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim();
        var datePart = trimmed.Length >= 10 ? trimmed.Substring(0, 10) : trimmed;
        return DateOnly.TryParse(datePart, out var parsed) ? parsed : null;
    }
}
