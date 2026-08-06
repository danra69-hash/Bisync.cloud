using Bisync.Api.Data;
using Bisync.Api.Serialization;
using Bisync.Api.Services;
using Bisync.Api.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
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
    // Platform / Dev Console surfaces always use the control-plane (shared) database.
    // Sales Module CRM (team, companies, client updates) is not tenant-scoped.
    // Company + Location registry must stay on the control plane too — a stale
    // X-Bisync-Company-Id pointing at a provisioned tenant DB (e.g. QA) would
    // otherwise make /api/companies return only that one company.
    if (path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/health", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/dev-console", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/sales-module", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/companies", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/locations", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/users", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/access-control", StringComparison.OrdinalIgnoreCase)
        // Floor plan layout is control-plane (shared), like locations registry.
        || path.StartsWith("/api/pos/floor-plan", StringComparison.OrdinalIgnoreCase)
        // Customer waitlist / QR order must hit the shared control-plane DB.
        || path.StartsWith("/api/pos/waitlist", StringComparison.OrdinalIgnoreCase)
        || path.StartsWith("/api/pos/qr-order", StringComparison.OrdinalIgnoreCase))
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
builder.Services.AddScoped<FifoBatchIssueService>();
builder.Services.AddScoped<PreCommittedPoDrawdownService>();
builder.Services.AddScoped<ComponentStockService>();
builder.Services.AddScoped<SplitUseService>();
builder.Services.AddScoped<ProductSaleInventoryService>();
builder.Services.AddScoped<ProductionInventoryService>();
builder.Services.AddScoped<StockCardService>();
builder.Services.AddScoped<IngredientUsageMetricsService>();
builder.Services.AddScoped<InventoryAlertComputationService>();
builder.Services.AddScoped<CogsAuditService>();
builder.Services.AddSingleton<SystemCogsAuditHistoryStore>();
builder.Services.AddScoped<SystemCogsAuditSnapshotService>();
builder.Services.AddScoped<SalesDataService>();
builder.Services.AddScoped<ReportsService>();
builder.Services.AddScoped<B2bSalesOrderService>();
builder.Services.AddScoped<InventoryCountService>();
builder.Services.AddScoped<WastageService>();
builder.Services.AddScoped<TransferService>();
builder.Services.AddScoped<CreditNoteService>();
builder.Services.AddScoped<CentralStoreService>();
builder.Services.AddScoped<LocationPartitionService>();
builder.Services.AddScoped<CompanyOperationalDbProvisioner>();
builder.Services.AddScoped<TenantPlacementService>();
builder.Services.AddScoped<TenantSchemaMigrationService>();
builder.Services.AddScoped<TenantRollupService>();
builder.Services.AddScoped<LocationSubscriptionService>();
builder.Services.AddScoped<VendorRatingService>();
builder.Services.AddScoped<PlatformLaunchService>();
builder.Services.AddScoped<SalesModuleCalendarSyncService>();
builder.Services.AddScoped<SalesModuleImportService>();
builder.Services.AddScoped<SalesModuleClientUpdateService>();
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
builder.Services.Configure<NutritionLibraryOptions>(
    builder.Configuration.GetSection(NutritionLibraryOptions.SectionName));
builder.Services.AddHttpClient("nutrition-library");
builder.Services.AddScoped<NutritionLibrarySyncService>();
builder.Services.AddScoped<ProductNutrientEstimateService>();
builder.Services.AddHostedService<DeferredDbStartupHostedService>();
builder.Services.AddHostedService<NutritionLibrarySyncHostedService>();
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
        options.JsonSerializerOptions.Converters.Add(new NullableDateOnlyJsonConverter());
        options.JsonSerializerOptions.Converters.Add(new DateOnlyJsonConverter());
    });
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    // Critical control-plane bootstrap only — keep this short so Cloud Run
    // can bind PORT before the startup probe times out. Seeders / partitions
    // run in DeferredDbStartupHostedService after Kestrel is listening.
    var resolver = scope.ServiceProvider.GetRequiredService<ITenantConnectionResolver>();
    var controlOptions = new DbContextOptionsBuilder<BisyncDbContext>()
        .UseNpgsql(resolver.DefaultOperationalConnection)
        .Options;
    await using var db = new BisyncDbContext(controlOptions);
    await PostgresDatabaseBootstrap.EnsureExistsAsync(resolver.DefaultOperationalConnection);
    await PostgresDatabaseBootstrap.EnsureExistsAsync(resolver.DefaultArchiveConnection);
    await db.Database.EnsureCreatedAsync();
    await SchemaPatcher.ApplyAsync(db);
    // RevMgmt seed + tenant registry warm-up run in DeferredDbStartupHostedService.
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors("DevCors");
}
else
{
    app.Use(async (context, next) =>
    {
        var path = context.Request.Path.Value ?? "";
        if (path.Equals("/Attendance/app", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/Attendance/app/", StringComparison.OrdinalIgnoreCase))
        {
            context.Request.Path = "/Attendance/app/index.html";
        }
        await next();
    });

    // Never cache the SPA shell — stale index.html keeps old JS without Dev Console routing.
    app.UseDefaultFiles();
    app.UseStaticFiles(new StaticFileOptions
    {
        OnPrepareResponse = ctx =>
        {
            var path = ctx.File.Name;
            // Service workers / web manifests must revalidate or browsers keep a year-old SW
            // (immutable) and portal modules like Human Resources fail to load new chunks.
            if (path.Equals("index.html", StringComparison.OrdinalIgnoreCase)
                || path.Equals("favicon.svg", StringComparison.OrdinalIgnoreCase)
                || path.Equals("favicon.ico", StringComparison.OrdinalIgnoreCase)
                || path.Equals("sw.js", StringComparison.OrdinalIgnoreCase)
                || path.Equals("manifest.webmanifest", StringComparison.OrdinalIgnoreCase)
                || path.Equals("manifest.json", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("workbox-", StringComparison.OrdinalIgnoreCase))
            {
                // Shell + favicon + SW must not stick after a mark change or stale image rollback.
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

    var attendanceAppRoot = Path.Combine(
        app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"),
        "Attendance",
        "app");
    if (Directory.Exists(attendanceAppRoot))
    {
        app.UseStaticFiles(new StaticFileOptions
        {
            FileProvider = new PhysicalFileProvider(attendanceAppRoot),
            RequestPath = "/Attendance/app",
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
                    ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
                }
            },
        });
    }
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
        var logger = context.RequestServices.GetService<ILoggerFactory>()
            ?.CreateLogger("UnhandledApiException");
        logger?.LogError(ex, "Unhandled error on {Method} {Path}", context.Request.Method, context.Request.Path);
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
    var webRoot = app.Environment.WebRootPath
        ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
    var attendanceIndex = Path.Combine(webRoot, "Attendance", "app", "index.html");
    var mainIndex = Path.Combine(webRoot, "index.html");

    // SPA deep links under /Attendance/app (avoid MapFallbackToFile ambiguity with root).
    if (File.Exists(attendanceIndex))
    {
        app.MapFallback("/Attendance/app/{*path}", async context =>
        {
            context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
            context.Response.ContentType = "text/html; charset=utf-8";
            await context.Response.SendFileAsync(attendanceIndex);
        });
    }

    // Never serve the SPA shell for API routes — that returns 200 HTML and breaks
    // Dev Console / fetchJson clients when an endpoint is missing or not yet deployed.
    app.MapFallback(async context =>
    {
        var path = context.Request.Path.Value ?? string.Empty;
        if (path.StartsWith("/Attendance/app", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        if (path.StartsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsJsonAsync(new { message = "API endpoint not found." });
            return;
        }

        // Missing static brand/media assets must 404 — never fall back to index.html
        // (that made deleted Vite icons look like they still "exist" as 200 HTML).
        if (LooksLikeStaticAssetPath(path))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
            return;
        }

        if (!File.Exists(mainIndex))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        context.Response.Headers.CacheControl = "no-store, no-cache, must-revalidate, max-age=0";
        context.Response.Headers.Pragma = "no-cache";
        context.Response.Headers.Expires = "0";
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(mainIndex);
    });
}

app.Run();

static bool LooksLikeStaticAssetPath(string path)
{
    var ext = Path.GetExtension(path.AsSpan());
    if (ext.IsEmpty) return false;
    return ext.Equals(".svg", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".ico", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".png", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".jpg", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".jpeg", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".gif", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".webp", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".woff", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".woff2", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".ttf", StringComparison.OrdinalIgnoreCase)
        || ext.Equals(".map", StringComparison.OrdinalIgnoreCase);
}
