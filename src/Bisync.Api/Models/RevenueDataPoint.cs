namespace Bisync.Api.Models;

public class RevenueDataPoint
{
    public int Id { get; set; }
    public string Period { get; set; } = "week";
    public string Label { get; set; } = string.Empty;
    public decimal CurrentValue { get; set; }
    public decimal PriorValue { get; set; }
    public int? Covers { get; set; }
}
