using System.Text.Json;
using Bisync.Api.Contracts;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/ordertemplates")]
public class OrderTemplatesController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] int? companyId)
    {
        IQueryable<OrderTemplate> query = db.OrderTemplates
            .AsNoTracking()
            .Include(t => t.Items);

        if (companyId is int id)
            query = query.Where(t => t.CompanyId == id);

        var rows = await query
            .OrderByDescending(t => t.UpdatedAt)
            .ThenByDescending(t => t.Id)
            .ToListAsync();

        return Ok(rows.Select(MapTemplate));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<object>> Get(int id)
    {
        var template = await db.OrderTemplates
            .AsNoTracking()
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == id);

        return template is null ? NotFound() : Ok(MapTemplate(template));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] UpsertOrderTemplateRequest request)
    {
        var validation = ValidateRequest(request);
        if (validation is not null)
            return BadRequest(new { message = validation });

        var template = new OrderTemplate
        {
            Name = request.Name.Trim(),
            VendorExternalId = request.VendorExternalId?.Trim() ?? string.Empty,
            VendorName = request.VendorName?.Trim() ?? string.Empty,
            ScheduleMode = request.ScheduleMode?.Trim() ?? string.Empty,
            WeekdaysJson = SerializeStringList(request.Weekdays),
            MonthDaysJson = SerializeIntList(request.MonthDays),
            RepeatEnabled = request.RepeatEnabled,
            CompanyId = request.CompanyId,
            LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds ?? []),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Items = MapItems(request.Items),
        };

        db.OrderTemplates.Add(template);
        await db.SaveChangesAsync();

        return Ok(MapTemplate(template));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(int id, [FromBody] UpsertOrderTemplateRequest request)
    {
        var validation = ValidateRequest(request);
        if (validation is not null)
            return BadRequest(new { message = validation });

        var template = await db.OrderTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template is null)
            return NotFound();

        template.Name = request.Name.Trim();
        template.VendorExternalId = request.VendorExternalId?.Trim() ?? string.Empty;
        template.VendorName = request.VendorName?.Trim() ?? string.Empty;
        template.ScheduleMode = request.ScheduleMode?.Trim() ?? string.Empty;
        template.WeekdaysJson = SerializeStringList(request.Weekdays);
        template.MonthDaysJson = SerializeIntList(request.MonthDays);
        template.RepeatEnabled = request.RepeatEnabled;
        template.CompanyId = request.CompanyId;
        template.LocationIdsJson = PurchaseOrderWorkflow.SerializeLocationIds(request.LocationExternalIds ?? []);
        template.UpdatedAt = DateTime.UtcNow;

        db.OrderTemplateItems.RemoveRange(template.Items);
        template.Items = MapItems(request.Items);

        await db.SaveChangesAsync();

        return Ok(MapTemplate(template));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var template = await db.OrderTemplates.FirstOrDefaultAsync(t => t.Id == id);
        if (template is null)
            return NotFound();

        db.OrderTemplates.Remove(template);
        await db.SaveChangesAsync();
        return NoContent();
    }

    static string? ValidateRequest(UpsertOrderTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return "Template name is required.";

        if (request.Items is null || request.Items.Count == 0)
            return "Add at least one component to the template.";

        var scheduleMode = request.ScheduleMode?.Trim() ?? string.Empty;
        var weekdays = request.Weekdays?.Where(day => !string.IsNullOrWhiteSpace(day)).ToList() ?? [];
        var monthDays = request.MonthDays?.Distinct().ToList() ?? [];

        if (scheduleMode == "weekday" && weekdays.Count == 0)
            return "Select at least one day of the week.";
        if (scheduleMode == "monthday" && monthDays.Count == 0)
            return "Select at least one day of the month.";
        if (scheduleMode == "weekday" && monthDays.Count > 0)
            return "Use either days of the week or days of the month, not both.";
        if (scheduleMode == "monthday" && weekdays.Count > 0)
            return "Use either days of the week or days of the month, not both.";

        foreach (var item in request.Items)
        {
            if (string.IsNullOrWhiteSpace(item.ComponentId))
                return "Each template line requires a component.";
            if (item.Quantity <= 0)
                return "Each template line requires a quantity greater than zero.";
        }

        return null;
    }

    static List<OrderTemplateItem> MapItems(List<UpsertOrderTemplateItemRequest> items)
        => items.Select((item, index) => new OrderTemplateItem
        {
            ComponentId = item.ComponentId.Trim(),
            ComponentName = item.ComponentName?.Trim() ?? string.Empty,
            VendorProductId = item.VendorProductId?.Trim() ?? string.Empty,
            VendorExternalId = item.VendorExternalId?.Trim() ?? string.Empty,
            VendorName = item.VendorName?.Trim() ?? string.Empty,
            ProductName = item.ProductName?.Trim() ?? string.Empty,
            Quantity = item.Quantity,
            ComponentUom = item.ComponentUom?.Trim() ?? string.Empty,
            DeliveryUnit = item.DeliveryUnit?.Trim() ?? string.Empty,
            SortOrder = index,
        }).ToList();

    static string SerializeStringList(IEnumerable<string>? values)
        => JsonSerializer.Serialize(values?.Where(v => !string.IsNullOrWhiteSpace(v)).Distinct().ToList() ?? [], JsonOptions);

    static string SerializeIntList(IEnumerable<int>? values)
        => JsonSerializer.Serialize(values?.Distinct().OrderBy(v => v).ToList() ?? [], JsonOptions);

    static List<string> DeserializeStringList(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    static List<int> DeserializeIntList(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<int>>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    static object MapTemplate(OrderTemplate template) => new
    {
        template.Id,
        name = template.Name,
        vendorExternalId = template.VendorExternalId,
        vendorName = template.VendorName,
        scheduleMode = template.ScheduleMode,
        weekdays = DeserializeStringList(template.WeekdaysJson),
        monthDays = DeserializeIntList(template.MonthDaysJson),
        repeatEnabled = template.RepeatEnabled,
        companyId = template.CompanyId,
        locationExternalIds = PurchaseOrderWorkflow.DeserializeLocationIds(template.LocationIdsJson),
        createdAt = template.CreatedAt,
        updatedAt = template.UpdatedAt,
        items = template.Items
            .OrderBy(i => i.SortOrder)
            .ThenBy(i => i.Id)
            .Select(i => new
            {
                i.Id,
                componentId = i.ComponentId,
                componentName = i.ComponentName,
                vendorProductId = i.VendorProductId,
                vendorExternalId = i.VendorExternalId,
                vendorName = i.VendorName,
                productName = i.ProductName,
                quantity = i.Quantity,
                componentUom = i.ComponentUom,
                deliveryUnit = i.DeliveryUnit,
                sortOrder = i.SortOrder,
            }),
    };
}
