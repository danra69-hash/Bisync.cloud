namespace Bisync.Api.Services;

public static class StockLocationRules
{
    /// <summary>Consolidated stock from archived purchases without explicit locations.</summary>
    public const string SharedLocationId = "__shared__";

    public static bool MovementMatchesLocation(string movementLocationId, string locationExternalId)
        => movementLocationId.Equals(SharedLocationId, StringComparison.OrdinalIgnoreCase)
            || movementLocationId.Equals(locationExternalId, StringComparison.OrdinalIgnoreCase);

    public static bool MovementMatchesAny(string movementLocationId, IReadOnlyList<string> locationIds)
        => movementLocationId.Equals(SharedLocationId, StringComparison.OrdinalIgnoreCase)
            || locationIds.Any(id => id.Equals(movementLocationId, StringComparison.OrdinalIgnoreCase));

    public static bool PurchaseMatchesLocation(string locationIdsJson, string locationExternalId)
    {
        var ids = PurchaseOrderWorkflow.DeserializeLocationIds(locationIdsJson);
        return ids.Count == 0
            || ids.Any(id => id.Equals(locationExternalId, StringComparison.OrdinalIgnoreCase));
    }

    public static bool PurchaseMatchesAny(string locationIdsJson, IReadOnlyList<string> locationIds)
    {
        var ids = PurchaseOrderWorkflow.DeserializeLocationIds(locationIdsJson);
        if (ids.Count == 0)
            return true;
        return locationIds.Any(selected =>
            ids.Any(id => id.Equals(selected, StringComparison.OrdinalIgnoreCase)));
    }
}
