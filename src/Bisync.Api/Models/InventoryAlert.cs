namespace Bisync.Api.Models;

public class InventoryAlert
{
    public int Id { get; set; }
    public string ItemName { get; set; } = string.Empty;
    public string Stock { get; set; } = string.Empty;
    public string Status { get; set; } = "low";
    public string Threshold { get; set; } = string.Empty;
}
