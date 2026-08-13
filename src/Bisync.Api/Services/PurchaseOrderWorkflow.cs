using System.Text.Json;
using Bisync.Api.Models;

namespace Bisync.Api.Services;

public static class PurchaseOrderWorkflow
{
    public const string DocumentTypePr = "PR";
    public const string DocumentTypePo = "PO";

    public const string StatusPendingApproval = "Pending Approval";
    public const string StatusOpen = "Open";
    public const string StatusConfirmed = "Confirmed";
    public const string StatusAccepted = "Accepted";
    public const string StatusReceived = "Received";
    public const string StatusPartiallyDelivered = "Partially Delivered";
    public const string StatusReconciled = "Reconciled";
    public const string StatusCommitted = "Committed";
    public const string StatusCommitmentClosed = "Commitment Closed";
    public const string StatusExpired = "Expired";

    /// <summary>Vendor must accept within this many working days (weekends excluded).</summary>
    public const int VendorAcceptWorkingDays = 7;

    /// <summary>
    /// Stock-card remark applied when ops confirms receive. Cleared on consolidate (accounting affirmation).
    /// </summary>
    public const string StockRemarkReceivedPending = "Received — pending consolidation";

    public static bool IsActive(PurchaseOrder order) =>
        !string.Equals(order.Status, StatusReconciled, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusExpired, StringComparison.OrdinalIgnoreCase);

    public static bool IsExpiredStatus(string? status) =>
        string.Equals(status?.Trim(), StatusExpired, StringComparison.OrdinalIgnoreCase);

    /// <summary>Last calendar day (inclusive) the vendor may accept, 7 working days after <paramref name="fromDate"/>.</summary>
    public static DateOnly ComputeVendorAcceptExpiry(DateOnly fromDate) =>
        WorkingDayCalendar.AddWorkingDays(fromDate, VendorAcceptWorkingDays);

    public static void AssignVendorAcceptExpiry(PurchaseOrder order, DateOnly fromDate)
    {
        order.VendorAcceptExpiryDate = ComputeVendorAcceptExpiry(fromDate);
    }

    /// <summary>Issued POs (including pre-committed) awaiting vendor acceptance need an accept-by date.</summary>
    public static bool NeedsVendorAcceptWindow(PurchaseOrder order) =>
        order.VendorAcceptedAt is null
        && !IsPendingApprovalStatus(order.Status)
        && !IsExpiredStatus(order.Status)
        && !string.Equals(order.Status, StatusReconciled, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusReceived, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase);

    public static bool IsVendorAcceptPastDeadline(PurchaseOrder order, DateOnly todayLocal) =>
        order.VendorAcceptedAt is null
        && WorkingDayCalendar.IsPastAcceptDeadline(order.VendorAcceptExpiryDate, todayLocal);

    /// <summary>
    /// Open company commitment available for drawdown. Vendor acceptance must not close this —
    /// only full drawdown sets <see cref="StatusCommitmentClosed"/>.
    /// </summary>
    public static bool IsPreCommittedActive(PurchaseOrder order) =>
        order.IsPreCommitted
        && !string.Equals(order.Status, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase);

    /// <summary>DB statuses that still allow release POs to draw from a pre-committed master.</summary>
    public static bool IsOpenPreCommitmentStatus(string? status)
    {
        var normalized = status?.Trim() ?? string.Empty;
        if (normalized.Length == 0) return false;
        if (string.Equals(normalized, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase))
            return false;
        // Committed is canonical; Accepted/Open/Confirmed may appear after vendor accept bugs or legacy rows.
        return string.Equals(normalized, StatusCommitted, StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, StatusAccepted, StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, StatusOpen, StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, StatusConfirmed, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Pre-committed masters are company-scoped; LocationIdsJson lists outlets allowed to draw down.
    /// A release may draw when company matches and at least one release location is allowed.
    /// </summary>
    public static bool AllowsDrawdownFrom(PurchaseOrder master, PurchaseOrder release)
    {
        if (!master.IsPreCommitted)
            return false;

        if (master.CompanyId is int masterCompany
            && release.CompanyId is int releaseCompany
            && masterCompany != releaseCompany)
            return false;

        var allowed = DeserializeLocationIds(master.LocationIdsJson);
        var releaseLocs = DeserializeLocationIds(release.LocationIdsJson);
        if (allowed.Count == 0 || releaseLocs.Count == 0)
            return false;

        return releaseLocs.Any(id =>
            allowed.Contains(id, StringComparer.OrdinalIgnoreCase));
    }

    public static bool IsPendingApprovalStatus(string? status)
    {
        var normalized = status?.Trim() ?? string.Empty;
        return string.Equals(normalized, StatusPendingApproval, StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsPartiallyDelivered(PurchaseOrder order) =>
        string.Equals(order.Status, StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase);

    public static bool CanApprove(PurchaseOrder order) =>
        IsPendingApprovalStatus(order.Status);

    public static bool CanVendorAccept(PurchaseOrder order, DateOnly? todayLocal = null)
    {
        if (order.VendorAcceptedAt is not null) return false;
        if (IsExpiredStatus(order.Status)) return false;
        if (IsPendingApprovalStatus(order.Status)) return false;
        if (string.Equals(order.Status, StatusReconciled, StringComparison.OrdinalIgnoreCase)) return false;
        if (string.Equals(order.Status, StatusReceived, StringComparison.OrdinalIgnoreCase)) return false;
        if (string.Equals(order.Status, StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase)) return false;
        if (string.Equals(order.Status, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase)) return false;

        var today = todayLocal ?? DateOnly.FromDateTime(DateTime.UtcNow);
        if (IsVendorAcceptPastDeadline(order, today)) return false;
        return true;
    }

    public static bool CanReceive(PurchaseOrder order, bool allowPartialDelivery = false)
    {
        if (order.IsPreCommitted)
            return false; // Master commitments are drawn down by release orders, not warehouse-received.

        if (IsExpiredStatus(order.Status))
            return false;

        if (!string.Equals(order.DocumentType, DocumentTypePo, StringComparison.OrdinalIgnoreCase))
            return false;

        if (allowPartialDelivery && IsPartiallyDelivered(order))
            return true;

        return string.Equals(order.Status, StatusOpen, StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, "Pending", StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, StatusConfirmed, StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, StatusAccepted, StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, "In Transit", StringComparison.OrdinalIgnoreCase);
    }

    public static bool CanReconcile(PurchaseOrder order) =>
        string.Equals(order.DocumentType, DocumentTypePo, StringComparison.OrdinalIgnoreCase)
        && string.Equals(order.Status, StatusReceived, StringComparison.OrdinalIgnoreCase);

    /// <summary>Correct receive qty/price/docs while staying Received (before consolidate).</summary>
    public static bool CanAmendReceived(PurchaseOrder order) =>
        string.Equals(order.DocumentType, DocumentTypePo, StringComparison.OrdinalIgnoreCase)
        && !order.IsPreCommitted
        && (string.Equals(order.Status, StatusReceived, StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase));

    /// <summary>Correct consolidated qty/price/docs while staying Reconciled.</summary>
    public static bool CanAmendReconciled(PurchaseOrder order) =>
        string.Equals(order.DocumentType, DocumentTypePo, StringComparison.OrdinalIgnoreCase)
        && !order.IsPreCommitted
        && string.Equals(order.Status, StatusReconciled, StringComparison.OrdinalIgnoreCase);

    public static bool CanFinalizeDelivery(PurchaseOrder order, bool allowPartialDelivery) =>
        allowPartialDelivery
        && string.Equals(order.DocumentType, DocumentTypePo, StringComparison.OrdinalIgnoreCase)
        && IsPartiallyDelivered(order)
        && order.FinalDeliveryCompletedAt is null;

    public static string ResolveDocumentType(string? documentType, string? status)
    {
        if (string.Equals(status, StatusPendingApproval, StringComparison.OrdinalIgnoreCase))
            return DocumentTypePr;

        if (!string.IsNullOrWhiteSpace(documentType))
            return documentType.Trim().ToUpperInvariant();

        return DocumentTypePo;
    }

    public static string ResolveStatus(string? documentType, string? status)
    {
        if (!string.IsNullOrWhiteSpace(status))
        {
            var trimmed = status.Trim();
            if (string.Equals(trimmed, StatusPendingApproval, StringComparison.OrdinalIgnoreCase))
                return StatusPendingApproval;
            if (string.Equals(trimmed, StatusReceived, StringComparison.OrdinalIgnoreCase))
                return StatusReceived;
            if (string.Equals(trimmed, StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase))
                return StatusPartiallyDelivered;
            if (string.Equals(trimmed, StatusReconciled, StringComparison.OrdinalIgnoreCase))
                return StatusReconciled;
            if (string.Equals(trimmed, StatusCommitted, StringComparison.OrdinalIgnoreCase))
                return StatusCommitted;
            if (string.Equals(trimmed, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase))
                return StatusCommitmentClosed;
            if (string.Equals(trimmed, StatusOpen, StringComparison.OrdinalIgnoreCase))
                return StatusOpen;
            if (string.Equals(trimmed, "Pending", StringComparison.OrdinalIgnoreCase))
                return StatusOpen;
        }

        return string.Equals(documentType, DocumentTypePr, StringComparison.OrdinalIgnoreCase)
            ? StatusPendingApproval
            : StatusOpen;
    }

    public static string SerializeLocationIds(IEnumerable<string> locationIds) =>
        JsonSerializer.Serialize(locationIds.Where(id => !string.IsNullOrWhiteSpace(id)).Select(id => id.Trim()).Distinct(StringComparer.OrdinalIgnoreCase));

    /// <summary>
    /// Collapse returnable deposit lines of the same type (name + UOM + unit price)
    /// into a single line with summed quantity. Product lines are left unchanged.
    /// </summary>
    /// <summary>
    /// Combine key for returnable deposit lines: name + UOM + unit price (case-insensitive name/UOM).
    /// </summary>
    public static string ReturnableDepositCombineKey(PurchaseOrderItem item)
    {
        var name = string.IsNullOrWhiteSpace(item.ReturnableItemName)
            ? item.Name.Trim()
            : item.ReturnableItemName.Trim();
        var uom = string.IsNullOrWhiteSpace(item.Unit) ? item.ComponentUom.Trim() : item.Unit.Trim();
        return $"{name.ToLowerInvariant()}|{uom.ToLowerInvariant()}|{item.UnitPrice:0.####}";
    }

    public static List<PurchaseOrderItem> CombineReturnableDepositItems(IEnumerable<PurchaseOrderItem> items)
    {
        var products = new List<PurchaseOrderItem>();
        var deposits = new Dictionary<string, PurchaseOrderItem>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in items)
        {
            if (!item.IsReturnableDeposit)
            {
                products.Add(item);
                continue;
            }

            var name = string.IsNullOrWhiteSpace(item.ReturnableItemName)
                ? item.Name.Trim()
                : item.ReturnableItemName.Trim();
            var uom = string.IsNullOrWhiteSpace(item.Unit) ? item.ComponentUom.Trim() : item.Unit.Trim();
            var key = ReturnableDepositCombineKey(item);

            if (deposits.TryGetValue(key, out var existing))
            {
                existing.Quantity += item.Quantity;
                continue;
            }

            item.Name = name;
            item.ComponentName = name;
            item.ReturnableItemName = name;
            item.Unit = uom;
            item.ComponentUom = string.IsNullOrWhiteSpace(item.ComponentUom) ? uom : item.ComponentUom;
            item.DeliveryPackage = string.IsNullOrWhiteSpace(item.DeliveryPackage) ? uom : item.DeliveryPackage;
            item.VendorProductId = string.Empty;
            item.ComponentId = string.Empty;
            deposits[key] = item;
        }

        products.AddRange(
            deposits.Values.OrderBy(d => d.ReturnableItemName, StringComparer.OrdinalIgnoreCase));
        return products;
    }

    /// <param name="consolidatedByItemId">
    /// For pre-committed masters: qty received &amp; consolidated on linked release POs, keyed by master item id.
    /// </param>
    /// <param name="deliveryLocation">Optional resolved ship-to address when DeliveryLocationExternalId is set.</param>
    /// <param name="sourceCommittedPoNumber">Release POs: master Pre-committed PO number when drawn down.</param>
    public static object MapOrder(
        PurchaseOrder order,
        bool allowPartialDelivery = false,
        IReadOnlyDictionary<int, decimal>? consolidatedByItemId = null,
        DeliveryLocation? deliveryLocation = null,
        string? sourceCommittedPoNumber = null,
        DateOnly? todayLocal = null)
    {
        var documentType = IsPendingApprovalStatus(order.Status)
            ? DocumentTypePr
            : order.DocumentType;

        var today = todayLocal ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var status = order.Status?.Trim() ?? string.Empty;
        var acceptExpired = IsVendorAcceptPastDeadline(order, today) || IsExpiredStatus(status);

        // Pre-committed masters stay Committed / Commitment Closed even after vendor accept,
        // unless the vendor accept window lapsed without acceptance.
        if (acceptExpired && order.VendorAcceptedAt is null)
        {
            status = StatusExpired;
        }
        else if (order.IsPreCommitted)
        {
            if (!string.Equals(status, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase)
                && !IsExpiredStatus(status))
                status = StatusCommitted;
        }
        else
        {
            var isTerminalReceipt =
                string.Equals(status, StatusReceived, StringComparison.OrdinalIgnoreCase)
                || string.Equals(status, StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase)
                || string.Equals(status, StatusReconciled, StringComparison.OrdinalIgnoreCase);

            if (order.VendorAcceptedAt is not null && !isTerminalReceipt && !IsExpiredStatus(status))
                status = StatusAccepted;
        }

        var committedQuantity = order.Items.Sum(i => i.Quantity);
        var drawnQuantityTotal = order.Items.Sum(i => i.DrawnQuantity);
        var consolidatedQuantity = 0m;
        if (order.IsPreCommitted && consolidatedByItemId is not null)
        {
            foreach (var item in order.Items)
                consolidatedQuantity += consolidatedByItemId.GetValueOrDefault(item.Id);
        }

        return new
        {
            order.Id,
            poNumber = order.PoNumber,
            vendorName = order.VendorName,
            vendorExternalId = order.VendorExternalId,
            orderDate = order.OrderDate,
            deliveryDate = order.DeliveryDate,
            documentType,
            status,
            companyId = order.CompanyId,
            locationExternalIds = DeserializeLocationIds(order.LocationIdsJson),
            deliveryLocationExternalId = string.IsNullOrWhiteSpace(order.DeliveryLocationExternalId)
                ? null
                : order.DeliveryLocationExternalId.Trim(),
            deliveryLocation = deliveryLocation is null
                ? null
                : new
                {
                    deliveryLocation.Id,
                    externalId = deliveryLocation.ExternalId,
                    locationExternalId = deliveryLocation.LocationExternalId,
                    companyId = deliveryLocation.CompanyId,
                    name = deliveryLocation.Name,
                    addressLine1 = deliveryLocation.AddressLine1,
                    addressLine2 = deliveryLocation.AddressLine2,
                    city = deliveryLocation.City,
                    stateProvince = deliveryLocation.StateProvince,
                    postcode = deliveryLocation.Postcode,
                    active = deliveryLocation.Active,
                },
            initiatedBy = order.InitiatedBy,
            approvedBy = order.ApprovedBy,
            approvedAt = order.ApprovedAt,
            receivedAt = order.ReceivedAt,
            reconciledAt = order.ReconciledAt,
            finalDeliveryCompletedAt = order.FinalDeliveryCompletedAt,
            isPreCommitted = order.IsPreCommitted,
            commitmentStartDate = order.CommitmentStartDate,
            commitmentEndDate = order.CommitmentEndDate,
            sourceCommittedPurchaseOrderId = order.SourceCommittedPurchaseOrderId,
            sourceCommittedPoNumber = string.IsNullOrWhiteSpace(sourceCommittedPoNumber)
                ? null
                : sourceCommittedPoNumber.Trim(),
            // Alias for UI: on masters these are the outlets permitted to draw down.
            drawdownLocationExternalIds = order.IsPreCommitted
                ? DeserializeLocationIds(order.LocationIdsJson)
                : null,
            committedQuantity = order.IsPreCommitted ? committedQuantity : (decimal?)null,
            drawnQuantityTotal = order.IsPreCommitted ? drawnQuantityTotal : (decimal?)null,
            consolidatedQuantity = order.IsPreCommitted ? consolidatedQuantity : (decimal?)null,
            vendorShareToken = order.VendorShareToken,
            vendorAcceptedAt = order.VendorAcceptedAt,
            vendorAcceptedBy = order.VendorAcceptedBy,
            vendorAcceptExpiryDate = order.VendorAcceptExpiryDate,
            vendorDoNumber = order.VendorDoNumber,
            vendorInvoiceNumber = order.VendorInvoiceNumber,
            productQualityRating = string.IsNullOrWhiteSpace(order.ProductQualityRating) ? null : order.ProductQualityRating,
            productQualityComment = string.IsNullOrWhiteSpace(order.ProductQualityComment) ? null : order.ProductQualityComment,
            hygieneRating = string.IsNullOrWhiteSpace(order.HygieneRating) ? null : order.HygieneRating,
            hygieneComment = string.IsNullOrWhiteSpace(order.HygieneComment) ? null : order.HygieneComment,
            allowPartialDelivery,
            canApprove = CanApprove(order),
            canVendorAccept = CanVendorAccept(order, today),
            canReceive = !acceptExpired && CanReceive(order, allowPartialDelivery),
            canReconcile = CanReconcile(order),
            canAmendReceived = CanAmendReceived(order),
            canAmendReconciled = CanAmendReconciled(order),
            canFinalizeDelivery = CanFinalizeDelivery(order, allowPartialDelivery),
            items = order.Items.Select(i => MapItem(
                i,
                order.IsPreCommitted,
                consolidatedByItemId?.GetValueOrDefault(i.Id) ?? 0m)).ToList(),
        };
    }

    public static object MapItem(
        PurchaseOrderItem item,
        bool isPreCommitted = false,
        decimal consolidatedQuantity = 0)
    {
        var delivered = item.DeliveredQuantity;
        var drawn = item.DrawnQuantity;
        var remainingDelivery = Math.Max(0m, item.Quantity - delivered);
        var remainingCommitment = Math.Max(0m, item.Quantity - drawn);
        return new
        {
            item.Id,
            componentId = item.ComponentId,
            componentName = string.IsNullOrWhiteSpace(item.ComponentName) ? item.Name : item.ComponentName,
            vendorProductId = item.VendorProductId,
            name = item.Name,
            quantity = item.Quantity,
            unitPrice = item.UnitPrice,
            issuedUnitPrice = item.IssuedUnitPrice > 0 ? item.IssuedUnitPrice : item.UnitPrice,
            unit = item.Unit,
            componentUom = item.ComponentUom,
            deliveryPackage = item.DeliveryPackage,
            receivedQuantity = item.ReceivedQuantity,
            receivedUnitPrice = item.ReceivedUnitPrice,
            reconciledQuantity = item.ReconciledQuantity,
            reconciledUnitPrice = item.ReconciledUnitPrice,
            deliveredQuantity = delivered,
            remainingQuantity = isPreCommitted ? remainingCommitment : remainingDelivery,
            drawnQuantity = drawn,
            remainingCommitmentQuantity = remainingCommitment,
            // Stocked qty from release POs that drew from this master line (receive + consolidate).
            consolidatedQuantity = isPreCommitted ? consolidatedQuantity : delivered,
            sourceCommittedPurchaseOrderItemId = item.SourceCommittedPurchaseOrderItemId,
            isCommitmentDrawdown = item.SourceCommittedPurchaseOrderItemId is > 0,
            taxAmount = item.TaxAmount,
            halalCertNo = item.HalalCertNo,
            productExpiryDate = string.IsNullOrWhiteSpace(item.ProductExpiryDate) ? null : item.ProductExpiryDate,
            receivedTemperature = item.ReceivedTemperature,
            isReturnableDeposit = item.IsReturnableDeposit,
            returnableItemName = string.IsNullOrWhiteSpace(item.ReturnableItemName) ? null : item.ReturnableItemName,
        };
    }

    public static List<string> DeserializeLocationIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
