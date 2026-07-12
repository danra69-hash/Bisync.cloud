using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class UserNotificationService
{
    public const string TypePurchaseRequestApproved = "purchase_request_approved";
    public const string TypePurchaseOrderAccepted = "purchase_order_accepted";
    public const string TypeTransferInitiated = "transfer_initiated";
    public const string TypeTransferReceived = "transfer_received";

    public static async Task NotifyPurchaseRequestApprovedAsync(
        BisyncDbContext db,
        PurchaseOrder order,
        string approvedBy)
    {
        var recipientName = order.InitiatedBy?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(recipientName))
            return;

        var approverName = approvedBy.Trim();
        if (string.Equals(recipientName, approverName, StringComparison.OrdinalIgnoreCase))
            return;

        var user = await db.AppUsers
            .AsNoTracking()
            .Where(u => u.Active)
            .FirstOrDefaultAsync(u => u.FullName.ToLower() == recipientName.ToLower());

        db.UserNotifications.Add(new UserNotification
        {
            UserId = user?.Id,
            RecipientName = recipientName,
            PurchaseOrderId = order.Id,
            Type = TypePurchaseRequestApproved,
            Title = $"Purchase request {order.PoNumber} approved",
            Body = $"Approved by {approverName}. Send the purchase order to {order.VendorName} using the vendor share link.",
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync();
    }

    public static async Task NotifyPurchaseOrderAcceptedAsync(
        BisyncDbContext db,
        PurchaseOrder order)
    {
        var recipientName = order.InitiatedBy?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(recipientName))
            return;

        var user = await db.AppUsers
            .AsNoTracking()
            .Where(u => u.Active)
            .FirstOrDefaultAsync(u => u.FullName.ToLower() == recipientName.ToLower());

        var acceptedBy = string.IsNullOrWhiteSpace(order.VendorAcceptedBy)
            ? order.VendorName
            : order.VendorAcceptedBy.Trim();

        db.UserNotifications.Add(new UserNotification
        {
            UserId = user?.Id,
            RecipientName = recipientName,
            PurchaseOrderId = order.Id,
            Type = TypePurchaseOrderAccepted,
            Title = $"Purchase order {order.PoNumber} accepted",
            Body = $"Accepted by {acceptedBy} from {order.VendorName}.",
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync();
    }

    public static async Task NotifyTransferInitiatedAsync(BisyncDbContext db, TransferEntry transfer)
    {
        var toLocation = await db.Locations
            .AsNoTracking()
            .Include(l => l.PrincipalContact)
            .FirstOrDefaultAsync(l => l.ExternalId == transfer.ToLocationExternalId);

        var fromName = await db.Locations.AsNoTracking()
            .Where(l => l.ExternalId == transfer.FromLocationExternalId)
            .Select(l => l.Name)
            .FirstOrDefaultAsync() ?? transfer.FromLocationExternalId;

        var toName = toLocation?.Name ?? transfer.ToLocationExternalId;
        var recipientName = toLocation?.PrincipalContact?.FullName?.Trim()
            ?? toLocation?.PrincipalContact?.Email?.Trim()
            ?? $"Location:{transfer.ToLocationExternalId}";

        db.UserNotifications.Add(new UserNotification
        {
            UserId = toLocation?.PrincipalContactUserId,
            RecipientName = recipientName,
            TransferId = transfer.Id,
            Type = TypeTransferInitiated,
            Title = $"Transfer inbound · {toName}",
            Body = $"{transfer.Quantity} {transfer.Uom} {transfer.ItemName} from {fromName}. Confirm receive on the Transfer page to post inbound stock.",
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync();
    }

    public static async Task NotifyTransferReceivedAsync(BisyncDbContext db, TransferEntry transfer)
    {
        if (string.IsNullOrWhiteSpace(transfer.InitiatedBy))
            return;

        var user = await db.AppUsers
            .AsNoTracking()
            .Where(u => u.Active)
            .FirstOrDefaultAsync(u => u.FullName.ToLower() == transfer.InitiatedBy.ToLower());

        var qty = transfer.ReceivedQuantity ?? transfer.Quantity;
        db.UserNotifications.Add(new UserNotification
        {
            UserId = user?.Id,
            RecipientName = transfer.InitiatedBy.Trim(),
            TransferId = transfer.Id,
            Type = TypeTransferReceived,
            Title = $"Transfer received · XFR-{transfer.Id}",
            Body = $"{qty} {transfer.Uom} {transfer.ItemName} confirmed at {transfer.ToLocationExternalId}.",
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync();
    }

    public static object Map(UserNotification notification) => new
    {
        notification.Id,
        userId = notification.UserId,
        recipientName = notification.RecipientName,
        purchaseOrderId = notification.PurchaseOrderId,
        transferId = notification.TransferId,
        type = notification.Type,
        title = notification.Title,
        body = notification.Body,
        createdAt = notification.CreatedAt,
        readAt = notification.ReadAt,
        isRead = notification.ReadAt is not null,
    };
}
