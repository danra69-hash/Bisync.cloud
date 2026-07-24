namespace Bisync.Api.Models;

public class Promotion
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    /// <summary>byDate | byQty</summary>
    public string DurationMode { get; set; } = "byDate";
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    /// <summary>discountPercent | knockedDownPrice | combo</summary>
    public string PromotionType { get; set; } = "discountPercent";
    public decimal? DiscountPercent { get; set; }
    /// <summary>Bundle price for one combo pack when PromotionType is combo.</summary>
    public decimal? ComboPrice { get; set; }
    /// <summary>Total combo packs when DurationMode is byQty for a combo.</summary>
    public decimal? ComboPackQty { get; set; }
    /// <summary>Remaining combo packs (byQty combo).</summary>
    public decimal? ComboPackRemaining { get; set; }
    public bool Active { get; set; } = true;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<PromotionProduct> Products { get; set; } = [];
}

public class PromotionProduct
{
    public int Id { get; set; }
    public int PromotionId { get; set; }
    public Promotion? Promotion { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string DeliveryUnit { get; set; } = string.Empty;
    /// <summary>Cap qty when DurationMode is byQty (non-combo).</summary>
    public decimal? PromoQty { get; set; }
    /// <summary>Remaining sellable promo qty (byQty non-combo). Starts equal to PromoQty.</summary>
    public decimal? RemainingQty { get; set; }
    /// <summary>Fixed promo price when PromotionType is knockedDownPrice.</summary>
    public decimal? KnockedDownPrice { get; set; }
    /// <summary>Units of this product included in one combo pack.</summary>
    public decimal? QtyPerCombo { get; set; }
}
