using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class UserNotificationService
{
    public const string TypePurchaseRequestApproved = "purchase_request_approved";

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

    public static object Map(UserNotification notification) => new
    {
        notification.Id,
        userId = notification.UserId,
        recipientName = notification.RecipientName,
        purchaseOrderId = notification.PurchaseOrderId,
        type = notification.Type,
        title = notification.Title,
        body = notification.Body,
        createdAt = notification.CreatedAt,
        readAt = notification.ReadAt,
        isRead = notification.ReadAt is not null,
    };
}
