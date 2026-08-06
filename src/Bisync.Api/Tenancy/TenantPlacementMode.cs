namespace Bisync.Api.Tenancy;

/// <summary>
/// Where a company's operational data lives. AWS/5k target: Shared or Shard by default;
/// Dedicated is enterprise opt-in (not the default onboarding path).
/// </summary>
public static class TenantPlacementMode
{
    public const string Shared = "shared";
    public const string Shard = "shard";
    public const string Dedicated = "dedicated";

    public static bool IsKnown(string? mode) =>
        string.Equals(mode, Shared, StringComparison.OrdinalIgnoreCase)
        || string.Equals(mode, Shard, StringComparison.OrdinalIgnoreCase)
        || string.Equals(mode, Dedicated, StringComparison.OrdinalIgnoreCase);
}
