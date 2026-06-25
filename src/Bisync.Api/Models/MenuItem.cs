namespace Bisync.Api.Models;

public class MenuItem
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "food";
    public int Orders { get; set; }
    public decimal Revenue { get; set; }
    public int MarginPercent { get; set; }
}
