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

    /// <summary>
    /// Default My Storage rows for demo locations (legacy seed). Prefer
    /// <see cref="StorageAssignmentForLocations"/> for real company locations.
    /// </summary>
    public static object StorageAssignment() =>
        StorageAssignmentForLocations(new[] { "downtown", "midtown", "westend" });

    /// <summary>
    /// Kitchen Freezer / Chiller / Dry Store for each location external id.
    /// Used so Inventory / Component Config dropdowns are never empty on cloud.
    /// </summary>
    public static object StorageAssignmentForLocations(IReadOnlyList<string> locationExternalIds)
    {
        var locations = locationExternalIds
            .Select(id => (id ?? string.Empty).Trim().ToLowerInvariant())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct()
            .ToList();

        if (locations.Count == 0)
            locations = ["downtown", "midtown", "westend"];

        var templates = new[]
        {
            new { area = "Kitchen", sourceStorageId = 1, name = "Walk-in Freezer", type = "Freezer", items = 0 },
            new { area = "Kitchen", sourceStorageId = 2, name = "Main Chiller", type = "Chiller", items = 0 },
            new { area = "Kitchen", sourceStorageId = 4, name = "Dry Store", type = "Dry Store", items = 0 },
        };

        var entries = new List<object>();
        var id = 1;
        foreach (var location in locations)
        {
            foreach (var template in templates)
            {
                entries.Add(new
                {
                    id,
                    location,
                    template.area,
                    template.sourceStorageId,
                    template.name,
                    template.type,
                    template.items,
                });
                id++;
            }
        }

        return new
        {
            areas = new[] { "Dining Room", "Bar", "Kitchen" },
            entries,
            nextEntryId = id,
        };
    }

    public static object ComponentCatalog() => new
    {
        extraGroups = Array.Empty<string>(),
        extraUoms = Array.Empty<string>(),
        extraStorages = Array.Empty<string>(),
    };
}
