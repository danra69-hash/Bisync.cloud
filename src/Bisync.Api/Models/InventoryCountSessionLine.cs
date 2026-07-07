namespace Bisync.Api.Models;

public class InventoryCountSessionLine
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public InventoryCountSession? Session { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public string ItemKey { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string Uom { get; set; } = string.Empty;
    public decimal SystemQty { get; set; }
    public decimal? CountedQty { get; set; }
    public decimal? VarianceQty { get; set; }
    public decimal? SystemUnitPrice { get; set; }
}
