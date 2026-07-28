namespace Bisync.Api.Models;

/// <summary>POS channel promotion schedule (Point-of-Sales → Promotion Scheduler).</summary>
public class PosPromotion
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    /// <summary>Null when <see cref="EndDateOpen"/> is true.</summary>
    public DateOnly? EndDate { get; set; }
    public bool EndDateOpen { get; set; }
    /// <summary>Local time-of-day window start (HH:mm).</summary>
    public TimeOnly StartTime { get; set; } = new(0, 0);
    /// <summary>Local time-of-day window end (HH:mm).</summary>
    public TimeOnly EndTime { get; set; } = new(23, 59);
    /// <summary>daily | daysOfWeek</summary>
    public string RepeatMode { get; set; } = "daily";
    /// <summary>JSON array of weekday codes when RepeatMode is daysOfWeek, e.g. ["Mon","Wed"].</summary>
    public string DaysOfWeekJson { get; set; } = "[]";
    public string? FilterCategory { get; set; }
    public string? FilterGroup { get; set; }
    /// <summary>discountPercent | discountPrice</summary>
    public string PromoType { get; set; } = "discountPercent";
    public bool Active { get; set; } = true;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<PosPromotionProduct> Products { get; set; } = [];
}

public class PosPromotionProduct
{
    public int Id { get; set; }
    public int PosPromotionId { get; set; }
    public PosPromotion? PosPromotion { get; set; }
    public int ProductId { get; set; }
    public string ProductCode { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    /// <summary>Recommended Retail Price snapshot at save time.</summary>
    public decimal Rrp { get; set; }
    /// <summary>COGS used with RRP / RPP at save time.</summary>
    public decimal Cogs { get; set; }
    /// <summary>Recommended Promotional Price.</summary>
    public decimal Rpp { get; set; }
    /// <summary>Discount percent off RRP (0–100).</summary>
    public decimal DiscountPercent { get; set; }
}
