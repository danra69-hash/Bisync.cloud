namespace Bisync.Api.Data;

public static class RevMgmtDefaults
{
    public static object ComponentHierarchy() => new
    {
        categories = new[]
        {
            new { id = 1, name = "Food" },
            new { id = 2, name = "Beverage" },
        },
        groups = new[]
        {
            new { id = 1, categoryId = 1, name = "Proteins", items = 12 },
            new { id = 2, categoryId = 1, name = "Dairy", items = 8 },
            new { id = 3, categoryId = 1, name = "Produce", items = 15 },
            new { id = 4, categoryId = 2, name = "Spirits", items = 24 },
            new { id = 5, categoryId = 1, name = "Dry Goods", items = 18 },
        },
        subGroups = new[]
        {
            new { id = 1, groupId = 1, name = "Beef", items = 5 },
            new { id = 2, groupId = 1, name = "Poultry", items = 4 },
            new { id = 3, groupId = 2, name = "Cheese", items = 6 },
            new { id = 4, groupId = 4, name = "Whisky", items = 10 },
        },
        nextCategoryId = 3,
        nextGroupId = 6,
        nextSubGroupId = 5,
    };

    public static object StorageAssignment() => new
    {
        areas = new[] { "Dining Room", "Bar", "Kitchen" },
        entries = new[]
        {
            new { id = 1, location = "downtown", area = "Kitchen", sourceStorageId = 1, name = "Walk-in Freezer", type = "Freezer", items = 18 },
            new { id = 2, location = "downtown", area = "Kitchen", sourceStorageId = 2, name = "Main Chiller", type = "Chiller", items = 32 },
            new { id = 3, location = "downtown", area = "Bar", sourceStorageId = 3, name = "Wine Cellar", type = "Wine Cellar", items = 14 },
            new { id = 4, location = "downtown", area = "Kitchen", sourceStorageId = 4, name = "Dry Store", type = "Dry Store", items = 41 },
            new { id = 5, location = "midtown", area = "Bar", sourceStorageId = 5, name = "Bar Cooler", type = "Chiller", items = 9 },
            new { id = 6, location = "midtown", area = "Kitchen", sourceStorageId = 6, name = "Prep Kitchen Store", type = "Prep Kitchen", items = 22 },
            new { id = 7, location = "westend", area = "Kitchen", sourceStorageId = 7, name = "Westend Freezer", type = "Freezer", items = 11 },
            new { id = 8, location = "westend", area = "Kitchen", sourceStorageId = 8, name = "Westend Chiller", type = "Chiller", items = 16 },
            new { id = 9, location = "midtown", area = "Kitchen", sourceStorageId = 4, name = "Dry Store", type = "Dry Store", items = 41 },
            new { id = 10, location = "westend", area = "Kitchen", sourceStorageId = 4, name = "Dry Store", type = "Dry Store", items = 41 },
        },
        nextEntryId = 11,
    };

    public static object ComponentCatalog() => new
    {
        extraGroups = Array.Empty<string>(),
        extraUoms = Array.Empty<string>(),
        extraStorages = Array.Empty<string>(),
    };
}
