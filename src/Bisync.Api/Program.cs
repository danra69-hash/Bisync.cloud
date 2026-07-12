using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// The DB password is injected separately (Secret Manager -> DB_PASSWORD) so it never
// appears in plain configuration. Append it to the connection strings when present.
static string ApplyDbPassword(string? connectionString, string? password)
{
    if (string.IsNullOrWhiteSpace(connectionString))
        return connectionString ?? string.Empty;
    if (string.IsNullOrEmpty(password) || connectionString.Contains("Password=", StringComparison.OrdinalIgnoreCase))
        return connectionString;
    var separator = connectionString.TrimEnd().EndsWith(';') ? string.Empty : ";";
    return $"{connectionString}{separator}Password={password}";
}

var dbPassword = builder.Configuration["DB_PASSWORD"];
var defaultConnection = ApplyDbPassword(
    builder.Configuration.GetConnectionString("DefaultConnection"), dbPassword);
var archiveConnection = ApplyDbPassword(
    builder.Configuration.GetConnectionString("ArchiveConnection"), dbPassword);

builder.Services.AddDbContext<BisyncDbContext>(options =>
    options.UseNpgsql(defaultConnection));

builder.Services.AddHttpClient<PublicHolidayCatalogService>();
builder.Services.AddScoped<PublicHolidaySyncService>();
builder.Services.AddScoped<PayrollCalculationService>();
builder.Services.AddScoped<IncomeTaxService>();
builder.Services.AddScoped<ReplacementPublicHolidayService>();
builder.Services.AddScoped<ComponentFifoCostingService>();
builder.Services.AddScoped<ComponentStockService>();
builder.Services.AddScoped<ProductSaleInventoryService>();
builder.Services.AddScoped<ProductionInventoryService>();
builder.Services.AddScoped<StockCardService>();
builder.Services.AddScoped<CogsAuditService>();
builder.Services.AddSingleton<SystemCogsAuditHistoryStore>();
builder.Services.AddScoped<SystemCogsAuditSnapshotService>();
builder.Services.AddScoped<SalesDataService>();
builder.Services.AddScoped<B2bSalesOrderService>();
builder.Services.AddScoped<InventoryCountService>();
builder.Services.AddScoped<WastageService>();
builder.Services.AddScoped<TransferService>();
builder.Services.AddScoped<LocationPartitionService>();
builder.Services.AddScoped<Bisync.Api.Tenancy.TenantContext>();
builder.Services.AddScoped<Bisync.Api.Tenancy.ITenantContext>(sp =>
    sp.GetRequiredService<Bisync.Api.Tenancy.TenantContext>());
builder.Services.Configure<StockCardArchiveOptions>(
    builder.Configuration.GetSection(StockCardArchiveOptions.SectionName));
builder.Services.AddDbContext<StockCardArchiveDbContext>(options =>
    options.UseNpgsql(archiveConnection));
builder.Services.AddScoped<StockCardArchiveService>();
builder.Services.AddHostedService<StockCardArchiveHostedService>();
builder.Services.AddHostedService<InventoryCountAutoConfirmHostedService>();
builder.Services.AddHostedService<SalesOrderLockExpiryHostedService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 512L * 1024 * 1024;
});
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 512L * 1024 * 1024;
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BisyncDbContext>();
    await db.Database.EnsureCreatedAsync();
    await SchemaPatcher.ApplyAsync(db);
    await RevMgmtStartup.InitializeAsync(db);
    await DataSeeder.SeedAsync(db);
    await ConfigurationSeeder.SeedAsync(db);
    await ConfigurationSeeder.PatchUserAssignmentsAsync(db);
    await ConfigurationSeeder.PatchSuperAdminPasswordAsync(db);
    // Catalogs + tenant registry need companies from ConfigurationSeeder (first boot).
    await VendorCatalogSeeder.EnsureCatalogVendorsAsync(db);
    await IngredientCatalogSeeder.EnsureCatalogIngredientsAsync(db);
    await SchemaPatcher.EnsureTenantRegistryAsync(db);
    await HrStartup.InitializeAsync(db);
    await StockCardArchiveStartup.InitializeAsync(scope.ServiceProvider);
    var partitions = scope.ServiceProvider.GetRequiredService<LocationPartitionService>();
    await partitions.EnsurePartitionsForAllLocationsAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors("DevCors");
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseHttpsRedirection();
app.UseMiddleware<Bisync.Api.Tenancy.TenantContextMiddleware>();

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException pg)
    {
        context.Response.StatusCode = pg.SqlState switch
        {
            "23505" => StatusCodes.Status409Conflict,
            "23503" => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError,
        };
        context.Response.ContentType = "application/json";
        var message = pg.SqlState switch
        {
                "23505" => pg.ConstraintName switch
                {
                    "PK_Products" => "Could not create product because the database ID sequence is out of sync. Restart the API to apply the latest schema patch.",
                    "PK_Employees" => "Could not create employee because the Employees ID sequence is out of sync. Restart the API to apply the latest schema patch.",
                    "IX_Products_ProductId" => "Product ID already exists. Refresh and choose a different name.",
                    "IX_Employees_Email" => "An employee with this email already exists.",
                    "IX_Employees_EmployeeCode" => "Employee code already exists. Refresh and try again.",
                    _ => "A record with the same identifier already exists. Please refresh and try again.",
                },
            "23503" => "This action references missing data. Please refresh and try again.",
            _ => "Could not save changes. Please try again.",
        };
        await context.Response.WriteAsJsonAsync(new { message });
    }
    catch (Exception ex)
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        var message = app.Environment.IsDevelopment()
            ? ex.Message
            : "An unexpected error occurred. Please try again.";
        await context.Response.WriteAsJsonAsync(new { message });
    }
});

app.MapControllers();

if (app.Environment.IsDevelopment())
{
    app.MapGet("/", () => Results.Redirect("/api/health"));
}
else
{
    app.MapFallbackToFile("index.html");
}

app.Run();
