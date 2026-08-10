namespace Bisync.Api.Models;

/// <summary>
/// POS modifier group: Compulsory, Food, Beverage, or Component SWAP.
/// </summary>
public class PosModifierGroup
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    /// <summary>compulsory | food | beverage | component-swap</summary>
    public string Kind { get; set; } = "food";
    public string Name { get; set; } = string.Empty;
    /// <summary>Display / fire order for compulsory groups on a product.</summary>
    public int Sequence { get; set; }
    public bool Required { get; set; }
    public int MinSelect { get; set; } = 1;
    public int MaxSelect { get; set; } = 1;
    /// <summary>
    /// When true, options that affect stock must link to products in the
    /// Food Modifier / Beverage Modifier product groups.
    /// </summary>
    public bool AffectsStock { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<PosModifierOption> Options { get; set; } = [];
    public List<PosModifierAttachment> Attachments { get; set; } = [];
}

public class PosModifierOption
{
    public int Id { get; set; }
    public int PosModifierGroupId { get; set; }
    public PosModifierGroup? PosModifierGroup { get; set; }
    public string Label { get; set; } = string.Empty;
    public int Sequence { get; set; }
    public long ExtraChargeCents { get; set; }
    /// <summary>Optional linked B2C product for stock-influencing modifiers (POS depletion).</summary>
    public int? LinkedProductId { get; set; }
    public string LinkedProductName { get; set; } = string.Empty;
    /// <summary>
    /// Linked smart-ingredient / component id for POS depletion when this option is selected
    /// (food/beverage Affects Stock, or Component SWAP chosen component).
    /// </summary>
    public string LinkedComponentId { get; set; } = string.Empty;
    public string LinkedComponentName { get; set; } = string.Empty;
    /// <summary>Base / original component id for Component SWAP (e.g. Garlic Mash).</summary>
    public string BaseComponentId { get; set; } = string.Empty;
    public string BaseComponentName { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
}

/// <summary>
/// Attach a modifier group by Category, Product Group, and/or Product
/// (empty fields mean All for that level — most specific fields win at match time).
/// </summary>
public class PosModifierAttachment
{
    public int Id { get; set; }
    public int PosModifierGroupId { get; set; }
    public PosModifierGroup? PosModifierGroup { get; set; }
    /// <summary>category | product-group | product — most specific scope set.</summary>
    public string TargetType { get; set; } = "product-group";
    public string TargetProductCategory { get; set; } = string.Empty;
    public string TargetProductGroup { get; set; } = string.Empty;
    public int? TargetProductId { get; set; }
    public string TargetProductName { get; set; } = string.Empty;
}
