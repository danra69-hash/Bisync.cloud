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

    public static bool IsActive(PurchaseOrder order) =>
        !string.Equals(order.Status, StatusReconciled, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase);

    public static bool IsPreCommittedActive(PurchaseOrder order) =>
        order.IsPreCommitted
        && string.Equals(order.Status, StatusCommitted, StringComparison.OrdinalIgnoreCase);

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

    public static bool CanVendorAccept(PurchaseOrder order) =>
        order.VendorAcceptedAt is null
        && !string.Equals(order.Status, StatusReconciled, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusReceived, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase);

    public static bool CanReceive(PurchaseOrder order, bool allowPartialDelivery = false)
    {
        if (order.IsPreCommitted)
            return false; // Master commitments are drawn down by release orders, not warehouse-received.

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

    /// <param name="consolidatedByItemId">
    /// For pre-committed masters: qty received &amp; consolidated on linked release POs, keyed by master item id.
    /// </param>
    public static object MapOrder(
        PurchaseOrder order,
        bool allowPartialDelivery = false,
        IReadOnlyDictionary<int, decimal>? consolidatedByItemId = null)
    {
        var documentType = IsPendingApprovalStatus(order.Status)
            ? DocumentTypePr
            : order.DocumentType;

        var status = order.Status?.Trim() ?? string.Empty;
        var isTerminalReceipt =
            string.Equals(status, StatusReceived, StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, StatusPartiallyDelivered, StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, StatusReconciled, StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, StatusCommitted, StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, StatusCommitmentClosed, StringComparison.OrdinalIgnoreCase);

        if (order.VendorAcceptedAt is not null && !isTerminalReceipt)
            status = StatusAccepted;

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
            vendorDoNumber = order.VendorDoNumber,
            vendorInvoiceNumber = order.VendorInvoiceNumber,
            productQualityRating = string.IsNullOrWhiteSpace(order.ProductQualityRating) ? null : order.ProductQualityRating,
            productQualityComment = string.IsNullOrWhiteSpace(order.ProductQualityComment) ? null : order.ProductQualityComment,
            hygieneRating = string.IsNullOrWhiteSpace(order.HygieneRating) ? null : order.HygieneRating,
            hygieneComment = string.IsNullOrWhiteSpace(order.HygieneComment) ? null : order.HygieneComment,
            allowPartialDelivery,
            canApprove = CanApprove(order),
            canReceive = CanReceive(order, allowPartialDelivery),
            canReconcile = CanReconcile(order),
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
            taxAmount = item.TaxAmount,
            halalCertNo = item.HalalCertNo,
            productExpiryDate = string.IsNullOrWhiteSpace(item.ProductExpiryDate) ? null : item.ProductExpiryDate,
            receivedTemperature = item.ReceivedTemperature,
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
