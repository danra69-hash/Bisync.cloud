using System.Text.Json;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

/// <summary>
/// Server-side mirror of client RMS task checks (see client/src/data/userAccess.ts).
/// </summary>
public static class UserAccessEvaluator
{
    public const string InventoryAdjustmentTask = "inventoryAdjustment";

    public static bool CanAdjustInventory(AppUser? user)
    {
        if (user is null || !user.Active)
            return false;

        return HasRmsTask(user, InventoryAdjustmentTask);
    }

    public static bool HasRmsTask(AppUser? user, string taskId)
    {
        if (user is null || !user.Active || string.IsNullOrWhiteSpace(taskId))
            return false;

        var role = (user.Role ?? string.Empty).Trim();
        if (role.Contains("Super Admin", StringComparison.OrdinalIgnoreCase)
            || role.Equals("DRA Super Admin", StringComparison.OrdinalIgnoreCase)
            || string.Equals(user.Email, SuperAdminAccess.SuperAdminEmail, StringComparison.OrdinalIgnoreCase))
            return true;

        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(user.AccessJson) ? "{}" : user.AccessJson);
            var root = doc.RootElement;

            if (root.TryGetProperty("superAdmin", out var super)
                && super.ValueKind == JsonValueKind.True
                && HasModule(root, "RMS"))
                return true;

            if (!HasModule(root, "RMS"))
                return false;

            if (!root.TryGetProperty("rms", out var rms) || rms.ValueKind != JsonValueKind.Object)
                return false;

            if (!rms.TryGetProperty("enabled", out var enabled) || enabled.ValueKind != JsonValueKind.True)
                return false;

            if (!rms.TryGetProperty("tasks", out var tasks) || tasks.ValueKind != JsonValueKind.Object)
                return false;

            return tasks.TryGetProperty(taskId, out var task) && task.ValueKind == JsonValueKind.True;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    static bool HasModule(JsonElement root, string module)
    {
        if (!root.TryGetProperty("modules", out var modules) || modules.ValueKind != JsonValueKind.Array)
            return false;

        foreach (var item in modules.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String
                && string.Equals(item.GetString(), module, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }
}
