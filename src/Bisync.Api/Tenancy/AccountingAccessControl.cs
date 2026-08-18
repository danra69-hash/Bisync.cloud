using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Tenancy;

/// <summary>
/// Enforces Access Control catalog task keys on Books / ledger mutations.
/// Platform admins always pass. Empty matrix (unticked world) allows ops until
/// a company configures AC — once any accounting:* row is present, require ticks.
/// </summary>
public static class AccountingAccessControl
{
    public const string JournalManage = "accounting:general-ledger:manage-journal-entries";
    public const string BankRec = "accounting:general-ledger:bank-reconciliation";
    public const string SoftClose = "accounting:general-ledger:soft-close-periods";
    public const string HardClose = "accounting:general-ledger:hard-close-periods";
    public const string ApManage = "accounting:accounts-payable:manage-vendor-bills";
    public const string ApPay = "accounting:accounts-payable:pay-bills";
    public const string ApApprove = "accounting:accounts-payable:approve-vendor-bills";
    public const string ArManage = "accounting:accounts-receivable:manage-customer-invoices";
    public const string ArReceive = "accounting:accounts-receivable:receive-payments";

    public static async Task<ActionResult?> RequireAsync(
        BisyncDbContext db,
        ITenantContext tenant,
        string taskKey,
        CancellationToken ct = default)
    {
        if (tenant.IsPlatformAdmin) return null;
        if (tenant.UserId is not > 0)
            return new UnauthorizedObjectResult(new { message = "Sign in required for Books." });

        var user = await db.AppUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == tenant.UserId.Value, ct);
        if (user is null)
            return new UnauthorizedObjectResult(new { message = "User not found." });

        try
        {
            using var accessDoc = JsonDocument.Parse(
                string.IsNullOrWhiteSpace(user.AccessJson) ? "{}" : user.AccessJson);
            if (accessDoc.RootElement.TryGetProperty("superAdmin", out var sa)
                && sa.ValueKind == JsonValueKind.True)
                return null;

            var typeId = accessDoc.RootElement.TryGetProperty("accessControlTypeId", out var tid)
                ? tid.GetString()?.Trim()
                : null;
            if (string.IsNullOrWhiteSpace(typeId))
            {
                // No AC type assigned — allow until the company configures roles.
                return null;
            }

            var settings = await db.AccessControlSettings.AsNoTracking().FirstOrDefaultAsync(ct);
            if (settings is null || string.IsNullOrWhiteSpace(settings.MatrixJson)
                || settings.MatrixJson.Trim() is "{}" or "null")
                return null;

            using var matrixDoc = JsonDocument.Parse(settings.MatrixJson);
            var root = matrixDoc.RootElement;

            // If this task key is not in the matrix at all, allow (catalog may be newer than matrix).
            if (!root.TryGetProperty(taskKey, out var row))
                return null;

            if (row.TryGetProperty(typeId, out var allowed) && allowed.ValueKind == JsonValueKind.True)
                return null;

            return new ObjectResult(new
            {
                message = $"Access denied for Accounting task '{taskKey}'. Ask an admin to tick this under Access Control.",
            })
            {
                StatusCode = StatusCodes.Status403Forbidden,
            };
        }
        catch
        {
            return null;
        }
    }
}
