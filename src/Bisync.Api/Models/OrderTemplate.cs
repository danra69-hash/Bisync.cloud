namespace Bisync.Api.Models;

public class OrderTemplate
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string ScheduleMode { get; set; } = string.Empty;
    public string WeekdaysJson { get; set; } = "[]";
    public string MonthDaysJson { get; set; } = "[]";
    public bool RepeatEnabled { get; set; }
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<OrderTemplateItem> Items { get; set; } = [];
}

public class OrderTemplateItem
{
    public int Id { get; set; }
    public int OrderTemplateId { get; set; }
    public OrderTemplate? OrderTemplate { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string VendorProductId { get; set; } = string.Empty;
    public string VendorExternalId { get; set; } = string.Empty;
    public string VendorName { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string ComponentUom { get; set; } = string.Empty;
    public string DeliveryUnit { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}
