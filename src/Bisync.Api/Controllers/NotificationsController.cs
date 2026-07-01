using Bisync.Api.Data;
using Bisync.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController(BisyncDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int userId,
        [FromQuery] string? recipientName,
        [FromQuery] bool unreadOnly = false)
    {
        if (userId <= 0 && string.IsNullOrWhiteSpace(recipientName))
            return BadRequest(new { message = "userId or recipientName is required." });

        var name = recipientName?.Trim() ?? string.Empty;
        IQueryable<Models.UserNotification> query = db.UserNotifications.AsNoTracking();

        if (userId > 0 && !string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(n =>
                n.UserId == userId
                || n.RecipientName.ToLower() == name.ToLower());
        }
        else if (userId > 0)
        {
            query = query.Where(n => n.UserId == userId);
        }
        else
        {
            query = query.Where(n => n.RecipientName.ToLower() == name.ToLower());
        }

        if (unreadOnly)
            query = query.Where(n => n.ReadAt == null);

        var rows = await query
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToListAsync();

        return Ok(rows.Select(UserNotificationService.Map));
    }

    [HttpPost("{id:int}/read")]
    public async Task<ActionResult<object>> MarkRead(int id)
    {
        var notification = await db.UserNotifications.FirstOrDefaultAsync(n => n.Id == id);
        if (notification is null) return NotFound();

        if (notification.ReadAt is null)
            notification.ReadAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(UserNotificationService.Map(notification));
    }
}
