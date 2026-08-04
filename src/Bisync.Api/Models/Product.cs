namespace Bisync.Api.Models;

public class Product
{
    public int Id { get; set; }
    public string ProductId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public bool IsSubProduct { get; set; }
    /// <summary>Sellable product with combination choices or weight-based pricing.</summary>
    public bool IsVariableProduct { get; set; }
    /// <summary>combination | weight</summary>
    public string VariableMode { get; set; } = string.Empty;
    /// <summary>For combination: total units the customer may choose.</summary>
    public decimal VariableChoiceQty { get; set; }
    /// <summary>JSON config for combination options or weight settings.</summary>
    public string VariableOptionsJson { get; set; } = "{}";
    public decimal VariableMinCost { get; set; }
    public decimal VariableMaxCost { get; set; }
    /// <summary>Product has substitutable recipe components (POS SWAP).</summary>
    public bool IsVariableComponent { get; set; }
    /// <summary>JSON slots/alternatives with optional extraCharge for Variable Component.</summary>
    public string VariableComponentOptionsJson { get; set; } = "{}";
    public bool B2cEnabled { get; set; }
    public bool B2bEnabled { get; set; }
    public string B2bPackageUnit { get; set; } = "pcs";
    public string B2bSalesConfigJson { get; set; } = "{}";
    public decimal TotalCost { get; set; }
    public decimal PackagingCost { get; set; }
    public decimal Rrp { get; set; }
    public decimal? PreviousTotalCost { get; set; }
    public decimal? PreviousPackagingCost { get; set; }
    public decimal? PreviousRrp { get; set; }
    public decimal YieldQuantity { get; set; }
    /// <summary>B2C Product UOM; Sub-Product batch UOM; B2B Principal Production UOM.</summary>
    public string YieldUom { get; set; } = string.Empty;
    /// <summary>Alternate production/batch UOMs JSON. For B2B Principal: up to 2 alts (1 alt = qty × principal).</summary>
    public string YieldAltUnitsJson { get; set; } = "[]";
    public int ExpiryPeriodDays { get; set; }
    public int ActivationPeriodHours { get; set; }
    /// <summary>Default sales-order stock lock period (days) for B2B Product / Active Order.</summary>
    public int OrderLockPeriodDays { get; set; } = 7;
    public decimal ParStock { get; set; }
    public string ParStockUom { get; set; } = string.Empty;
    public bool PosEnabled { get; set; }
    public string PosDeliveryUnitsJson { get; set; } = "[]";
    /// <summary>POS Menu sales unit label (from company UOM catalog / product units).</summary>
    public string PosSalesUom { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public int? CompanyId { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<ProductComponentItem> Items { get; set; } = [];
    public List<ProductPackagingItem> PackagingItems { get; set; } = [];
    public List<ProductAlias> Aliases { get; set; } = [];
}

public class ProductPackagingItem
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string ComponentUom { get; set; } = string.Empty;
    public decimal ComponentUomPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal Subtotal { get; set; }
    public int SortOrder { get; set; }
}

public class ProductAlias
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Rrp { get; set; }
    public string B2bSalesConfigJson { get; set; } = "{}";
    public int SortOrder { get; set; }
}

public class ProductComponentItem
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public string ComponentId { get; set; } = string.Empty;
    public string ComponentName { get; set; } = string.Empty;
    public string ComponentUom { get; set; } = string.Empty;
    public decimal ComponentUomPrice { get; set; }
    public decimal Quantity { get; set; }
    public decimal Subtotal { get; set; }
    public int SortOrder { get; set; }
}
