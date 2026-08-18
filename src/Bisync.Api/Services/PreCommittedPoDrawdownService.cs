using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

/// <summary>
/// Draws release-order quantities from active pre-committed (blanket) POs,
/// applying the committed special unit price when a match is found.
/// Masters are company-scoped; LocationIdsJson lists outlets allowed to draw down.
/// </summary>
public class PreCommittedPoDrawdownService(BisyncDbContext db)
{
    public async Task ApplyDrawdownsAsync(
        IReadOnlyList<PurchaseOrder> releaseOrders,
        CancellationToken cancellationToken = default)
    {
        if (releaseOrders.Count == 0)
            return;

        var companyIds = releaseOrders
            .Where(o => o.CompanyId is not null)
            .Select(o => o.CompanyId!.Value)
            .Distinct()
            .ToList();
        var countryByCompany = await db.Companies.AsNoTracking()
            .Where(c => companyIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.CountryCode, cancellationToken);
        // Commitment windows are evaluated in each company's local calendar day.
        var todayByCompany = companyIds.ToDictionary(
            id => id,
            id => OrgClock.TodayLocal(countryByCompany.GetValueOrDefault(id, "MY")));
        var today = todayByCompany.Values.DefaultIfEmpty(OrgClock.TodayLocal("MY")).Min();
        var vendorKeys = releaseOrders
            .Select(o => (o.VendorExternalId ?? string.Empty).Trim())
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var vendorNames = releaseOrders
            .Select(o => (o.VendorName ?? string.Empty).Trim())
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var mastersQuery = db.PurchaseOrders
            .Include(p => p.Items)
            .Where(p => p.IsPreCommitted && p.Status != PurchaseOrderWorkflow.StatusCommitmentClosed)
            .Where(p =>
                (p.CommitmentStartDate == null || p.CommitmentStartDate <= today)
                && (p.CommitmentEndDate == null || p.CommitmentEndDate >= today));

        if (companyIds.Count > 0)
            mastersQuery = mastersQuery.Where(p => p.CompanyId == null || companyIds.Contains(p.CompanyId.Value));

        var masters = await mastersQuery.ToListAsync(cancellationToken);

        masters = masters
            .Where(m => PurchaseOrderWorkflow.IsOpenPreCommitmentStatus(m.Status))
            .Where(m =>
            {
                var ext = (m.VendorExternalId ?? string.Empty).Trim();
                var name = (m.VendorName ?? string.Empty).Trim();
                if (!string.IsNullOrWhiteSpace(ext) && vendorKeys.Contains(ext, StringComparer.OrdinalIgnoreCase))
                    return true;
                return vendorNames.Contains(name, StringComparer.OrdinalIgnoreCase);
            })
            .OrderBy(m => m.CommitmentStartDate ?? m.OrderDate)
            .ThenBy(m => m.Id)
            .ToList();

        if (masters.Count == 0)
            return;

        // Restore canonical status when vendor-accept incorrectly flipped Committed → Accepted.
        foreach (var master in masters)
        {
            if (!string.Equals(master.Status, PurchaseOrderWorkflow.StatusCommitted, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(master.Status, PurchaseOrderWorkflow.StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase))
            {
                master.Status = PurchaseOrderWorkflow.StatusCommitted;
            }
        }

        foreach (var release in releaseOrders)
        {
            if (release.IsPreCommitted)
                continue;

            var preferredMasterId = release.SourceCommittedPurchaseOrderId;
            foreach (var item in release.Items)
            {
                // Already linked to a commitment line — do not double-count DrawnQuantity.
                if (item.SourceCommittedPurchaseOrderItemId is > 0)
                    continue;

                var remainingToCover = item.Quantity;
                if (remainingToCover <= 0)
                    continue;

                var candidates = masters
                    .Where(m => PurchaseOrderWorkflow.AllowsDrawdownFrom(m, release))
                    .Where(m => VendorMatches(m, release))
                    .Where(m => preferredMasterId is null || m.Id == preferredMasterId)
                    .Where(m => ReleaseFallsInCommitmentWindow(m, release))
                    .SelectMany(m => m.Items.Select(ci => (Master: m, Line: ci)))
                    .Where(x => LineMatches(x.Line, item))
                    .Where(x => x.Line.Quantity - x.Line.DrawnQuantity > 0.0001m)
                    .OrderBy(x => x.Master.CommitmentStartDate ?? x.Master.OrderDate)
                    .ThenBy(x => x.Master.Id)
                    .ThenBy(x => x.Line.Id)
                    .ToList();

                foreach (var (master, committedLine) in candidates)
                {
                    if (remainingToCover <= 0.0001m)
                        break;

                    var available = committedLine.Quantity - committedLine.DrawnQuantity;
                    if (available <= 0.0001m)
                        continue;

                    var take = Math.Min(available, remainingToCover);
                    committedLine.DrawnQuantity = DecimalRounding.ToDb(committedLine.DrawnQuantity + take);
                    // Special committed (bulk) price for the release line.
                    item.UnitPrice = committedLine.UnitPrice;
                    item.IssuedUnitPrice = committedLine.UnitPrice;
                    item.SourceCommittedPurchaseOrderItemId ??= committedLine.Id;
                    release.SourceCommittedPurchaseOrderId ??= master.Id;
                    remainingToCover -= take;

                    if (master.Items.All(i => i.DrawnQuantity + 0.0001m >= i.Quantity))
                        master.Status = PurchaseOrderWorkflow.StatusCommitmentClosed;
                }
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Repair rows broken when vendor accept flipped pre-committed masters to Accepted
    /// (blocking drawdown) and re-link release POs that should have drawn down.
    /// </summary>
    public async Task RepairAcceptedMastersAndOrphanReleasesAsync(
        CancellationToken cancellationToken = default)
    {
        var flipped = await db.PurchaseOrders
            .Where(p => p.IsPreCommitted
                && p.Status != PurchaseOrderWorkflow.StatusCommitted
                && p.Status != PurchaseOrderWorkflow.StatusCommitmentClosed)
            .ToListAsync(cancellationToken);

        foreach (var master in flipped)
            master.Status = PurchaseOrderWorkflow.StatusCommitted;

        if (flipped.Count > 0)
            await db.SaveChangesAsync(cancellationToken);

        var orphans = await db.PurchaseOrders
            .Include(p => p.Items)
            .Where(p => !p.IsPreCommitted
                && p.SourceCommittedPurchaseOrderId == null
                && p.Items.Any(i =>
                    i.SourceCommittedPurchaseOrderItemId == null
                    && !i.IsReturnableDeposit
                    && i.Quantity > 0))
            .ToListAsync(cancellationToken);

        if (orphans.Count == 0)
            return;

        await ApplyDrawdownsAsync(orphans, cancellationToken);
    }

    static bool ReleaseFallsInCommitmentWindow(PurchaseOrder master, PurchaseOrder release)
    {
        var orderDate = release.OrderDate;
        if (master.CommitmentStartDate is DateOnly start && orderDate < start)
            return false;
        if (master.CommitmentEndDate is DateOnly end && orderDate > end)
            return false;
        return true;
    }

    static bool VendorMatches(PurchaseOrder master, PurchaseOrder release)
    {
        var masterExt = (master.VendorExternalId ?? string.Empty).Trim();
        var releaseExt = (release.VendorExternalId ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(masterExt) && !string.IsNullOrWhiteSpace(releaseExt))
            return string.Equals(masterExt, releaseExt, StringComparison.OrdinalIgnoreCase);
        return string.Equals(
            (master.VendorName ?? string.Empty).Trim(),
            (release.VendorName ?? string.Empty).Trim(),
            StringComparison.OrdinalIgnoreCase);
    }

    static bool LineMatches(PurchaseOrderItem committed, PurchaseOrderItem release)
    {
        var committedVp = (committed.VendorProductId ?? string.Empty).Trim();
        var releaseVp = (release.VendorProductId ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(committedVp) && !string.IsNullOrWhiteSpace(releaseVp))
            return string.Equals(committedVp, releaseVp, StringComparison.OrdinalIgnoreCase);

        var committedComp = (committed.ComponentId ?? string.Empty).Trim();
        var releaseComp = (release.ComponentId ?? string.Empty).Trim();
        if (!string.IsNullOrWhiteSpace(committedComp) && !string.IsNullOrWhiteSpace(releaseComp))
            return string.Equals(committedComp, releaseComp, StringComparison.OrdinalIgnoreCase);

        return string.Equals(
            (committed.Name ?? string.Empty).Trim(),
            (release.Name ?? string.Empty).Trim(),
            StringComparison.OrdinalIgnoreCase);
    }
}
