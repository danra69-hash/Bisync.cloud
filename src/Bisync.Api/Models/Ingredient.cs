namespace Bisync.Api.Models;

public class Ingredient
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string RecipeUom { get; set; } = string.Empty;
    public string InventoryUom { get; set; } = string.Empty;
    public decimal LastPriceRecipe { get; set; }
    public decimal LastPriceInventory { get; set; }
    public decimal DailyUsage { get; set; }
    public int OrderFreqDays { get; set; }
    public string StorageJson { get; set; } = "[]";
    public int AttachedProducts { get; set; }
    public int AttachedVendors { get; set; }
    public bool Active { get; set; } = true;
    public string LocationsJson { get; set; } = "[]";
}
