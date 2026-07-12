namespace Bisync.Api.Models;

public class UserNotification
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public int? PurchaseOrderId { get; set; }
    public int? TransferId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}
