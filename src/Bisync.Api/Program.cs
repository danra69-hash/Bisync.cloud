using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BisyncDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

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
builder.Services.AddScoped<InventoryCountService>();
builder.Services.Configure<StockCardArchiveOptions>(
    builder.Configuration.GetSection(StockCardArchiveOptions.SectionName));
builder.Services.AddDbContext<StockCardArchiveDbContext>((sp, options) =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var environment = sp.GetRequiredService<IHostEnvironment>();
    var databasePath = StockCardArchivePaths.ResolveArchiveDatabasePath(configuration, environment);
    Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
    options.UseSqlite($"Data Source={databasePath};Cache=Shared");
});
builder.Services.AddScoped<StockCardArchiveService>();
builder.Services.AddHostedService<StockCardArchiveHostedService>();
builder.Services.AddHostedService<InventoryCountAutoConfirmHostedService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("DevCors", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod());
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
    await DataSeeder.SeedAsync(db);
    await ConfigurationSeeder.SeedAsync(db);
    await ConfigurationSeeder.PatchUserAssignmentsAsync(db);
    await HrStartup.InitializeAsync(db);
    await StockCardArchiveStartup.InitializeAsync(scope.ServiceProvider);
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
