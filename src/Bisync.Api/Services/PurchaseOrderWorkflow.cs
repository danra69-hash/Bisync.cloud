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
    public const string StatusReconciled = "Reconciled";

    public static bool IsActive(PurchaseOrder order) =>
        !string.Equals(order.Status, StatusReconciled, StringComparison.OrdinalIgnoreCase);

    public static bool IsPendingApprovalStatus(string? status)
    {
        var normalized = status?.Trim() ?? string.Empty;
        return string.Equals(normalized, StatusPendingApproval, StringComparison.OrdinalIgnoreCase);
    }

    public static bool CanApprove(PurchaseOrder order) =>
        IsPendingApprovalStatus(order.Status);

    public static bool CanVendorAccept(PurchaseOrder order) =>
        order.VendorAcceptedAt is null
        && !string.Equals(order.Status, StatusReconciled, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(order.Status, StatusReceived, StringComparison.OrdinalIgnoreCase);

    public static bool CanReceive(PurchaseOrder order)
    {
        if (!string.Equals(order.DocumentType, DocumentTypePo, StringComparison.OrdinalIgnoreCase))
            return false;

        return string.Equals(order.Status, StatusOpen, StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, "Pending", StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, StatusConfirmed, StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, StatusAccepted, StringComparison.OrdinalIgnoreCase)
            || string.Equals(order.Status, "In Transit", StringComparison.OrdinalIgnoreCase);
    }

    public static bool CanReconcile(PurchaseOrder order) =>
        string.Equals(order.DocumentType, DocumentTypePo, StringComparison.OrdinalIgnoreCase)
        && string.Equals(order.Status, StatusReceived, StringComparison.OrdinalIgnoreCase);

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
            if (string.Equals(trimmed, StatusReconciled, StringComparison.OrdinalIgnoreCase))
                return StatusReconciled;
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

    public static object MapOrder(PurchaseOrder order)
    {
        var documentType = IsPendingApprovalStatus(order.Status)
            ? DocumentTypePr
            : order.DocumentType;

        var status = order.Status?.Trim() ?? string.Empty;
        if (order.VendorAcceptedAt is not null
            && !string.Equals(status, StatusReceived, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(status, StatusReconciled, StringComparison.OrdinalIgnoreCase))
        {
            status = StatusAccepted;
        }

        return new
    {
        order.Id,
        poNumber = order.PoNumber,
        vendorName = order.VendorName,
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
        vendorShareToken = order.VendorShareToken,
        vendorAcceptedAt = order.VendorAcceptedAt,
        vendorAcceptedBy = order.VendorAcceptedBy,
        vendorDoNumber = order.VendorDoNumber,
        vendorInvoiceNumber = order.VendorInvoiceNumber,
        productQualityRating = string.IsNullOrWhiteSpace(order.ProductQualityRating) ? null : order.ProductQualityRating,
        hygieneRating = string.IsNullOrWhiteSpace(order.HygieneRating) ? null : order.HygieneRating,
        canApprove = CanApprove(order),
        canReceive = CanReceive(order),
        canReconcile = CanReconcile(order),
        items = order.Items.Select(MapItem).ToList(),
    };
    }

    public static object MapItem(PurchaseOrderItem item) => new
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
        taxAmount = item.TaxAmount,
        halalCertNo = item.HalalCertNo,
        productExpiryDate = string.IsNullOrWhiteSpace(item.ProductExpiryDate) ? null : item.ProductExpiryDate,
        receivedTemperature = item.ReceivedTemperature,
    };

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
