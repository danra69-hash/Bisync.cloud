using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Deactivates purchase orders whose vendor did not accept within 7 working days.
/// </summary>
public sealed class PurchaseOrderAcceptExpiryService(BisyncDbContext db)
{
    public async Task<int> ExpireOverdueAsync(CancellationToken cancellationToken = default)
    {
        var candidates = await db.PurchaseOrders
            .Where(o => o.VendorAcceptedAt == null
                && o.Status != PurchaseOrderWorkflow.StatusExpired
                && o.Status != PurchaseOrderWorkflow.StatusReconciled
                && o.Status != PurchaseOrderWorkflow.StatusReceived
                && o.Status != PurchaseOrderWorkflow.StatusPartiallyDelivered
                && o.Status != PurchaseOrderWorkflow.StatusCommitmentClosed
                && o.Status != PurchaseOrderWorkflow.StatusPendingApproval)
            .ToListAsync(cancellationToken);

        if (candidates.Count == 0)
            return 0;

        var companyIds = candidates
            .Where(o => o.CompanyId is > 0)
            .Select(o => o.CompanyId!.Value)
            .Distinct()
            .ToList();
        var countryByCompany = await db.Companies.AsNoTracking()
            .Where(c => companyIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.CountryCode, cancellationToken);

        var expired = 0;
        foreach (var order in candidates)
        {
            var country = "MY";
            if (order.CompanyId is int companyId && countryByCompany.TryGetValue(companyId, out var code))
                country = string.IsNullOrWhiteSpace(code) ? "MY" : code;

            var today = OrgClock.TodayLocal(country);

            if (order.VendorAcceptExpiryDate is null && PurchaseOrderWorkflow.NeedsVendorAcceptWindow(order))
            {
                var from = order.OrderDate;
                if (order.ApprovedAt is DateTime approvedAt)
                    from = DateOnly.FromDateTime(CountryTimeZones.ToLocal(approvedAt, country));
                PurchaseOrderWorkflow.AssignVendorAcceptExpiry(order, from);
            }

            if (!PurchaseOrderWorkflow.IsVendorAcceptPastDeadline(order, today))
                continue;

            order.Status = PurchaseOrderWorkflow.StatusExpired;
            expired++;
        }

        if (expired > 0)
            await db.SaveChangesAsync(cancellationToken);

        return expired;
    }
}
