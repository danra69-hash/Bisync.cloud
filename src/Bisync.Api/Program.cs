using Bisync.Api.Data;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

static string ResolveOperationalConnection(IServiceProvider sp)
{
    var resolver = sp.GetRequiredService<ITenantConnectionResolver>();
    var http = sp.GetService<IHttpContextAccessor>()?.HttpContext;
    if (http is null)
        return resolver.DefaultOperationalConnection;

    var path = http.Request.Path.Value ?? string.Empty;
    // Auth + health always use the control-plane (shared) database.
    if (path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/health", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/dev-console", StringComparison.OrdinalIgnoreCase))
        return resolver.DefaultOperationalConnection;

    int? companyId = null;
    if (int.TryParse(http.Request.Headers[TenantContextMiddleware.CompanyHeader].FirstOrDefault(), out var headerCompany)
        && headerCompany > 0)
        companyId = headerCompany;
    else
        companyId = sp.GetService<ITenantContext>()?.CompanyId;

    return resolver.ResolveOperationalConnection(companyId);
}

static string ResolveArchiveConnection(IServiceProvider sp)
{
    var resolver = sp.GetRequiredService<ITenantConnectionResolver>();
    var http = sp.GetService<IHttpContextAccessor>()?.HttpContext;
    int? companyId = null;
    if (http is not null
        && int.TryParse(http.Request.Headers[TenantContextMiddleware.CompanyHeader].FirstOrDefault(), out var headerCompany)
        && headerCompany > 0)
        companyId = headerCompany;
    else
        companyId = sp.GetService<ITenantContext>()?.CompanyId;

    return resolver.ResolveArchiveConnection(companyId);
}

static string ResolveAuditConnection(IServiceProvider sp)
{
    var config = sp.GetRequiredService<IConfiguration>();
    return SystemAuditStartup.ApplyPassword(
        config.GetConnectionString("AuditConnection")
        ?? SystemAuditStartup.DeriveDatabase(
            config.GetConnectionString("DefaultConnection") ?? string.Empty,
            SystemAuditStartup.DatabaseName),
        config["DB_PASSWORD"]);
}

builder.Services.Configure<TenancyOptions>(builder.Configuration.GetSection(TenancyOptions.SectionName));
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<IEmailSender, LoggingEmailSender>();
builder.Services.AddSingleton<ITenantConnectionResolver, TenantConnectionResolver>();
builder.Services.AddSingleton<SystemAuditSaveChangesInterceptor>();

builder.Services.AddDbContext<BisyncDbContext>((sp, options) =>
{
    options.UseNpgsql(ResolveOperationalConnection(sp));
    options.AddInterceptors(sp.GetRequiredService<SystemAuditSaveChangesInterceptor>());
});

builder.Services.AddHttpClient<PublicHolidayCatalogService>();
builder.Services.AddScoped<PublicHolidaySyncService>();
builder.Services.AddScoped<PayrollCalculationService>();
builder.Services.AddScoped<IncomeTaxService>();
builder.Services.AddScoped<ReplacementPublicHolidayService>();
builder.Services.AddScoped<ComponentFifoCostingService>();
builder.Services.AddScoped<ComponentStockService>();
builder.Services.AddScoped<SplitUseService>();
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
builder.Services.AddScoped<CompanyOperationalDbProvisioner>();
builder.Services.AddScoped<TenantRollupService>();
builder.Services.AddScoped<VendorRatingService>();
builder.Services.Configure<DevConsoleAuthOptions>(
    builder.Configuration.GetSection(DevConsoleAuthOptions.SectionName));
builder.Services.AddHttpClient("google-oauth");
builder.Services.AddHttpClient("geo-hint");
builder.Services.AddScoped<DevConsoleAuthService>();
builder.Services.AddScoped<Bisync.Api.Tenancy.TenantContext>();
builder.Services.AddScoped<Bisync.Api.Tenancy.ITenantContext>(sp =>
    sp.GetRequiredService<Bisync.Api.Tenancy.TenantContext>());
builder.Services.Configure<StockCardArchiveOptions>(
    builder.Configuration.GetSection(StockCardArchiveOptions.SectionName));
builder.Services.AddDbContext<StockCardArchiveDbContext>((sp, options) =>
    options.UseNpgsql(ResolveArchiveConnection(sp)));
builder.Services.AddScoped<StockCardArchiveService>();
builder.Services.AddHostedService<StockCardArchiveHostedService>();
builder.Services.AddDbContext<SystemAuditDbContext>((sp, options) =>
    options.UseNpgsql(ResolveAuditConnection(sp)));
builder.Services.AddScoped<ISystemAuditService, SystemAuditService>();
builder.Services.AddHostedService<SystemAuditArchiveHostedService>();
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
    // Startup always patches the shared control-plane database.
    var resolver = scope.ServiceProvider.GetRequiredService<ITenantConnectionResolver>();
    var controlOptions = new DbContextOptionsBuilder<BisyncDbContext>()
        .UseNpgsql(resolver.DefaultOperationalConnection)
        .Options;
    await using var db = new BisyncDbContext(controlOptions);
    // Create missing DBs with a clear error before EF EnsureCreated tries CREATE DATABASE.
    await PostgresDatabaseBootstrap.EnsureExistsAsync(resolver.DefaultOperationalConnection);
    await PostgresDatabaseBootstrap.EnsureExistsAsync(resolver.DefaultArchiveConnection);
    await db.Database.EnsureCreatedAsync();
    await SchemaPatcher.ApplyAsync(db);
    await RevMgmtStartup.InitializeAsync(db);
    await DataSeeder.SeedAsync(db);
    await ConfigurationSeeder.SeedAsync(db);
    await ConfigurationSeeder.PatchUserAssignmentsAsync(db);
    await ConfigurationSeeder.PatchSuperAdminPasswordAsync(db);
    await VendorCatalogSeeder.EnsureCatalogVendorsAsync(db);
    await IngredientCatalogSeeder.EnsureCatalogIngredientsAsync(db);
    await SchemaPatcher.EnsureTenantRegistryAsync(db);
    await HrStartup.InitializeAsync(db);
    await StockCardArchiveStartup.InitializeAsync(scope.ServiceProvider);
    await SystemAuditStartup.InitializeAsync(scope.ServiceProvider);
    await scope.ServiceProvider.GetRequiredService<DevConsoleAuthService>().EnsureRootUserAsync();

    var partitions = scope.ServiceProvider.GetRequiredService<LocationPartitionService>();
    await partitions.EnsureLocationListPartitionsAsync();
    await partitions.EnsurePartitionsForAllLocationsAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors("DevCors");
}
else
{
    // Never cache the SPA shell — stale index.html keeps old JS without Dev Console routing.
    app.UseDefaultFiles();
    app.UseStaticFiles(new StaticFileOptions
    {
        OnPrepareResponse = ctx =>
        {
            var path = ctx.File.Name;
            if (path.Equals("index.html", StringComparison.OrdinalIgnoreCase))
            {
                ctx.Context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
                ctx.Context.Response.Headers.Pragma = "no-cache";
                ctx.Context.Response.Headers.Expires = "0";
            }
            else if (path.EndsWith(".js", StringComparison.OrdinalIgnoreCase)
                || path.EndsWith(".css", StringComparison.OrdinalIgnoreCase))
            {
                // Hashed Vite assets are immutable.
                ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            }
        },
    });
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
    app.MapFallback(async context =>
    {
        context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
        context.Response.Headers.Pragma = "no-cache";
        context.Response.Headers.Expires = "0";
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "index.html"));
    });
}

app.Run();
