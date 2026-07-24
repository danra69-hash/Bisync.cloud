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
    /// <summary>discountPercent | knockedDownPrice</summary>
    public string PromotionType { get; set; } = "discountPercent";
    public decimal? DiscountPercent { get; set; }
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
    /// <summary>Cap qty when DurationMode is byQty.</summary>
    public decimal? PromoQty { get; set; }
    /// <summary>Remaining sellable promo qty (byQty). Starts equal to PromoQty.</summary>
    public decimal? RemainingQty { get; set; }
    /// <summary>Fixed promo price when PromotionType is knockedDownPrice.</summary>
    public decimal? KnockedDownPrice { get; set; }
}
