using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BisyncDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

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
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
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
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("DevCors");
app.UseHttpsRedirection();
app.MapControllers();

app.MapGet("/", () => Results.Redirect("/api/health"));

app.Run();
