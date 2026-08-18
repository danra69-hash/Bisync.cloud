namespace Bisync.Api.Data;

public static class RevMgmtDefaults
{
    /// <summary>
    /// Empty hierarchy — categories/groups come from user creation and live components,
    /// not demo residue (Food/Proteins/Beef sample tree).
    /// </summary>
    public static object ComponentHierarchy() => new
    {
        categories = Array.Empty<object>(),
        groups = Array.Empty<object>(),
        subGroups = Array.Empty<object>(),
        nextCategoryId = 1,
        nextGroupId = 1,
        nextSubGroupId = 1,
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
        myUoms = Array.Empty<string>(),
        extraStorages = Array.Empty<string>(),
        hiddenUoms = Array.Empty<string>(),
    };
}
