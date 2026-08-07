using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/team-chat")]
public class TeamChatController(BisyncDbContext db) : ControllerBase
{
    public const string SendAnnouncementTaskKey = "human-resource-management:team:send-company-announcement";
    const int MaxAttachmentChars = 2_500_000;

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    [HttpGet("directory")]
    public async Task<ActionResult<IEnumerable<object>>> Directory([FromQuery] int employeeId)
    {
        var ctx = await ResolveEmployeeContextAsync(employeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });

        var companyEmployeeIds = await CompanyEmployeeIdsAsync(ctx.CompanyId);
        var query = db.Employees.AsNoTracking().Where(e => e.Active);
        if (companyEmployeeIds.Count > 0)
            query = query.Where(e => companyEmployeeIds.Contains(e.Id));

        var rows = await query
            .OrderBy(e => e.Name)
            .Select(e => new
            {
                e.Id,
                e.Name,
                e.Email,
                e.Mobile,
                e.Department,
                e.Position,
                e.EmployeeCode,
            })
            .ToListAsync();

        return Ok(rows);
    }

    [HttpGet("conversations")]
    public async Task<ActionResult<object>> ListConversations([FromQuery] int employeeId)
    {
        var ctx = await ResolveEmployeeContextAsync(employeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });

        await EnsureAnnouncementAsync(ctx.CompanyId);

        var memberConvIds = await db.TeamConversationMembers.AsNoTracking()
            .Where(m => m.EmployeeId == employeeId)
            .Select(m => m.ConversationId)
            .ToListAsync();

        var announcementIds = await db.TeamConversations.AsNoTracking()
            .Where(c => c.CompanyId == ctx.CompanyId && c.Type == "announcement")
            .Select(c => c.Id)
            .ToListAsync();

        var allIds = memberConvIds.Union(announcementIds).Distinct().ToList();
        if (allIds.Count == 0)
            return Ok(new { canSendAnnouncement = await CanSendAnnouncementAsync(employeeId), conversations = Array.Empty<object>() });

        var conversations = await db.TeamConversations.AsNoTracking()
            .Where(c => allIds.Contains(c.Id))
            .OrderByDescending(c => c.UpdatedAt)
            .ToListAsync();

        var members = await db.TeamConversationMembers.AsNoTracking()
            .Where(m => allIds.Contains(m.ConversationId))
            .ToListAsync();
        var employeeIds = members.Select(m => m.EmployeeId).Distinct().ToList();
        var employees = await db.Employees.AsNoTracking()
            .Where(e => employeeIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id);

        var recentMessages = await db.TeamChatMessages.AsNoTracking()
            .Where(m => allIds.Contains(m.ConversationId))
            .OrderByDescending(m => m.CreatedAt)
            .ThenByDescending(m => m.Id)
            .ToListAsync();
        var lastByConv = recentMessages
            .GroupBy(m => m.ConversationId)
            .ToDictionary(g => g.Key, g => g.First());

        var myMemberships = await db.TeamConversationMembers.AsNoTracking()
            .Where(m => m.EmployeeId == employeeId && allIds.Contains(m.ConversationId))
            .ToDictionaryAsync(m => m.ConversationId);
        var unreadCounts = recentMessages
            .Where(m => m.SenderEmployeeId != employeeId)
            .GroupBy(m => m.ConversationId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    myMemberships.TryGetValue(g.Key, out var mem);
                    return g.Count(m => mem?.LastReadAt == null || m.CreatedAt > mem.LastReadAt);
                });

        var payload = conversations.Select(c =>
        {
            lastByConv.TryGetValue(c.Id, out var last);
            unreadCounts.TryGetValue(c.Id, out var unread);
            var peerIds = members
                .Where(m => m.ConversationId == c.Id && m.EmployeeId != employeeId)
                .Select(m => m.EmployeeId)
                .ToList();
            var peerNames = peerIds
                .Select(id => employees.TryGetValue(id, out var emp) ? emp.Name : $"#{id}")
                .ToList();
            var title = c.Type == "announcement"
                ? (string.IsNullOrWhiteSpace(c.Title) ? "Company Announcement" : c.Title)
                : peerNames.Count > 0
                    ? string.Join(", ", peerNames)
                    : (string.IsNullOrWhiteSpace(c.Title) ? "Conversation" : c.Title);

            return new
            {
                c.Id,
                c.CompanyId,
                c.Type,
                title,
                c.UpdatedAt,
                unreadCount = unread,
                peerEmployeeIds = peerIds,
                lastMessage = last is null
                    ? null
                    : new
                    {
                        last.Id,
                        last.Body,
                        last.SenderEmployeeId,
                        last.CreatedAt,
                        hasAttachment = !string.IsNullOrWhiteSpace(last.AttachmentBase64),
                    },
            };
        });

        return Ok(new
        {
            canSendAnnouncement = await CanSendAnnouncementAsync(employeeId),
            conversations = payload,
        });
    }

    [HttpGet("conversations/{id:int}/messages")]
    public async Task<ActionResult<object>> ListMessages(int id, [FromQuery] int employeeId, [FromQuery] int? afterId = null)
    {
        var ctx = await ResolveEmployeeContextAsync(employeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });

        var conversation = await db.TeamConversations.FirstOrDefaultAsync(c => c.Id == id);
        if (conversation is null) return NotFound(new { message = "Conversation not found." });
        if (conversation.CompanyId != ctx.CompanyId)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Conversation is outside your company." });

        var isMember = await db.TeamConversationMembers
            .AnyAsync(m => m.ConversationId == id && m.EmployeeId == employeeId);
        if (!isMember && conversation.Type != "announcement")
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You are not a member of this conversation." });

        if (conversation.Type == "announcement" && !isMember)
            await EnsureMemberAsync(id, employeeId);

        IQueryable<TeamChatMessage> query = db.TeamChatMessages.AsNoTracking()
            .Where(m => m.ConversationId == id);
        if (afterId is > 0)
            query = query.Where(m => m.Id > afterId.Value);

        var messages = await query
            .OrderBy(m => m.CreatedAt)
            .ThenBy(m => m.Id)
            .Take(200)
            .ToListAsync();

        var senderIds = messages.Select(m => m.SenderEmployeeId).Distinct().ToList();
        var senders = await db.Employees.AsNoTracking()
            .Where(e => senderIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.Name);

        var membership = await db.TeamConversationMembers
            .FirstOrDefaultAsync(m => m.ConversationId == id && m.EmployeeId == employeeId);
        if (membership is not null)
        {
            membership.LastReadAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        return Ok(new
        {
            conversation = new
            {
                conversation.Id,
                conversation.Type,
                title = conversation.Type == "announcement"
                    ? (string.IsNullOrWhiteSpace(conversation.Title) ? "Company Announcement" : conversation.Title)
                    : conversation.Title,
                canSend = conversation.Type != "announcement" || await CanSendAnnouncementAsync(employeeId),
            },
            messages = messages.Select(m => new
            {
                m.Id,
                m.SenderEmployeeId,
                senderName = senders.TryGetValue(m.SenderEmployeeId, out var name) ? name : $"#{m.SenderEmployeeId}",
                m.Body,
                attachmentContentType = string.IsNullOrWhiteSpace(m.AttachmentContentType) ? null : m.AttachmentContentType,
                hasAttachment = !string.IsNullOrWhiteSpace(m.AttachmentBase64),
                attachmentDataUrl = string.IsNullOrWhiteSpace(m.AttachmentBase64)
                    ? null
                    : $"data:{(string.IsNullOrWhiteSpace(m.AttachmentContentType) ? "image/png" : m.AttachmentContentType)};base64,{m.AttachmentBase64}",
                m.CreatedAt,
                mine = m.SenderEmployeeId == employeeId,
            }),
        });
    }

    [HttpPost("conversations/direct")]
    public async Task<ActionResult<object>> StartDirect([FromBody] TeamChatStartDirectRequest request)
    {
        if (request.EmployeeId <= 0 || request.PeerEmployeeId <= 0)
            return BadRequest(new { message = "employeeId and peerEmployeeId are required." });
        if (request.EmployeeId == request.PeerEmployeeId)
            return BadRequest(new { message = "Cannot start a chat with yourself." });

        var ctx = await ResolveEmployeeContextAsync(request.EmployeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });

        var peer = await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == request.PeerEmployeeId && e.Active);
        if (peer is null) return NotFound(new { message = "Peer employee not found." });

        var existing = await FindDirectConversationAsync(ctx.CompanyId, request.EmployeeId, request.PeerEmployeeId);
        if (existing is not null)
            return Ok(new { id = existing.Id, type = existing.Type, title = peer.Name, created = false });

        var now = DateTime.UtcNow;
        var conversation = new TeamConversation
        {
            CompanyId = ctx.CompanyId,
            Type = "direct",
            Title = string.Empty,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.TeamConversations.Add(conversation);
        await db.SaveChangesAsync();

        db.TeamConversationMembers.AddRange(
            new TeamConversationMember { ConversationId = conversation.Id, EmployeeId = request.EmployeeId, JoinedAt = now },
            new TeamConversationMember { ConversationId = conversation.Id, EmployeeId = request.PeerEmployeeId, JoinedAt = now });
        await db.SaveChangesAsync();

        return Ok(new { id = conversation.Id, type = conversation.Type, title = peer.Name, created = true });
    }

    [HttpPost("conversations/{id:int}/messages")]
    public async Task<ActionResult<object>> PostMessage(int id, [FromBody] TeamChatPostMessageRequest request)
    {
        if (request.EmployeeId <= 0)
            return BadRequest(new { message = "employeeId is required." });

        var body = (request.Body ?? string.Empty).Trim();
        var attachment = (request.AttachmentBase64 ?? string.Empty).Trim();
        if (attachment.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
        {
            var comma = attachment.IndexOf(',');
            if (comma > 0) attachment = attachment[(comma + 1)..];
        }

        if (string.IsNullOrWhiteSpace(body) && string.IsNullOrWhiteSpace(attachment))
            return BadRequest(new { message = "Message body or attachment is required." });
        if (attachment.Length > MaxAttachmentChars)
            return BadRequest(new { message = "Attachment is too large." });

        var ctx = await ResolveEmployeeContextAsync(request.EmployeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });

        var conversation = await db.TeamConversations.FirstOrDefaultAsync(c => c.Id == id);
        if (conversation is null) return NotFound(new { message = "Conversation not found." });
        if (conversation.CompanyId != ctx.CompanyId)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Conversation is outside your company." });

        if (conversation.Type == "announcement")
        {
            if (!await CanSendAnnouncementAsync(request.EmployeeId))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to send company announcements." });
            await EnsureMemberAsync(id, request.EmployeeId);
        }
        else
        {
            var isMember = await db.TeamConversationMembers
                .AnyAsync(m => m.ConversationId == id && m.EmployeeId == request.EmployeeId);
            if (!isMember)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "You are not a member of this conversation." });
        }

        var now = DateTime.UtcNow;
        var message = new TeamChatMessage
        {
            ConversationId = id,
            SenderEmployeeId = request.EmployeeId,
            Body = body,
            AttachmentBase64 = attachment,
            AttachmentContentType = string.IsNullOrWhiteSpace(request.AttachmentContentType)
                ? (string.IsNullOrWhiteSpace(attachment) ? string.Empty : "image/png")
                : request.AttachmentContentType.Trim(),
            CreatedAt = now,
        };
        db.TeamChatMessages.Add(message);
        conversation.UpdatedAt = now;

        var membership = await db.TeamConversationMembers
            .FirstOrDefaultAsync(m => m.ConversationId == id && m.EmployeeId == request.EmployeeId);
        if (membership is not null)
            membership.LastReadAt = now;

        await db.SaveChangesAsync();

        return Ok(new
        {
            message.Id,
            message.ConversationId,
            message.SenderEmployeeId,
            message.Body,
            hasAttachment = !string.IsNullOrWhiteSpace(message.AttachmentBase64),
            attachmentContentType = string.IsNullOrWhiteSpace(message.AttachmentContentType) ? null : message.AttachmentContentType,
            message.CreatedAt,
            mine = true,
        });
    }

    [HttpGet("capabilities")]
    public async Task<ActionResult<object>> Capabilities([FromQuery] int employeeId)
    {
        var ctx = await ResolveEmployeeContextAsync(employeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });
        return Ok(new
        {
            companyId = ctx.CompanyId,
            canSendAnnouncement = await CanSendAnnouncementAsync(employeeId),
        });
    }

    async Task<EmployeeContext?> ResolveEmployeeContextAsync(int employeeId)
    {
        var employee = await db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return null;

        var appUser = await db.AppUsers.AsNoTracking()
            .FirstOrDefaultAsync(u => u.EmployeeId == employeeId);
        var companyId = appUser?.CompanyId;
        if (companyId is null or <= 0)
        {
            companyId = await db.Companies.AsNoTracking()
                .Where(c => c.Active)
                .OrderBy(c => c.Id)
                .Select(c => (int?)c.Id)
                .FirstOrDefaultAsync();
        }

        return new EmployeeContext(employeeId, companyId ?? 0, appUser);
    }

    async Task<HashSet<int>> CompanyEmployeeIdsAsync(int companyId)
    {
        if (companyId <= 0) return [];
        var ids = await db.AppUsers.AsNoTracking()
            .Where(u => u.CompanyId == companyId && u.EmployeeId != null && u.Active)
            .Select(u => u.EmployeeId!.Value)
            .ToListAsync();
        return ids.ToHashSet();
    }

    async Task EnsureAnnouncementAsync(int companyId)
    {
        if (companyId <= 0) return;
        var existing = await db.TeamConversations
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Type == "announcement");
        if (existing is not null) return;

        var now = DateTime.UtcNow;
        var conversation = new TeamConversation
        {
            CompanyId = companyId,
            Type = "announcement",
            Title = "Company Announcement",
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.TeamConversations.Add(conversation);
        await db.SaveChangesAsync();

        var employeeIds = await CompanyEmployeeIdsAsync(companyId);
        if (employeeIds.Count == 0)
        {
            employeeIds = (await db.Employees.AsNoTracking().Where(e => e.Active).Select(e => e.Id).ToListAsync()).ToHashSet();
        }

        foreach (var empId in employeeIds)
        {
            db.TeamConversationMembers.Add(new TeamConversationMember
            {
                ConversationId = conversation.Id,
                EmployeeId = empId,
                JoinedAt = now,
            });
        }
        await db.SaveChangesAsync();
    }

    async Task EnsureMemberAsync(int conversationId, int employeeId)
    {
        var exists = await db.TeamConversationMembers
            .AnyAsync(m => m.ConversationId == conversationId && m.EmployeeId == employeeId);
        if (exists) return;
        db.TeamConversationMembers.Add(new TeamConversationMember
        {
            ConversationId = conversationId,
            EmployeeId = employeeId,
            JoinedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
    }

    async Task<TeamConversation?> FindDirectConversationAsync(int companyId, int a, int b)
    {
        var candidates = await db.TeamConversations.AsNoTracking()
            .Where(c => c.CompanyId == companyId && c.Type == "direct")
            .Select(c => c.Id)
            .ToListAsync();
        if (candidates.Count == 0) return null;

        var memberRows = await db.TeamConversationMembers.AsNoTracking()
            .Where(m => candidates.Contains(m.ConversationId))
            .GroupBy(m => m.ConversationId)
            .Select(g => new
            {
                ConversationId = g.Key,
                Members = g.Select(x => x.EmployeeId).ToList(),
            })
            .ToListAsync();

        var matchId = memberRows
            .FirstOrDefault(row =>
                row.Members.Count == 2
                && row.Members.Contains(a)
                && row.Members.Contains(b))
            ?.ConversationId;
        if (matchId is null) return null;
        return await db.TeamConversations.AsNoTracking().FirstOrDefaultAsync(c => c.Id == matchId);
    }

    async Task<bool> CanSendAnnouncementAsync(int employeeId)
    {
        var appUser = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(u => u.EmployeeId == employeeId);
        if (appUser is null) return false;

        try
        {
            using var accessDoc = JsonDocument.Parse(string.IsNullOrWhiteSpace(appUser.AccessJson) ? "{}" : appUser.AccessJson);
            if (accessDoc.RootElement.TryGetProperty("superAdmin", out var sa) && sa.ValueKind == JsonValueKind.True)
                return true;
            var typeId = accessDoc.RootElement.TryGetProperty("accessControlTypeId", out var tid)
                ? tid.GetString()?.Trim()
                : null;
            if (string.IsNullOrWhiteSpace(typeId)) return false;

            var settings = await db.AccessControlSettings.AsNoTracking().FirstOrDefaultAsync();
            if (settings is null || string.IsNullOrWhiteSpace(settings.MatrixJson)) return false;

            using var matrixDoc = JsonDocument.Parse(settings.MatrixJson);
            if (!matrixDoc.RootElement.TryGetProperty(SendAnnouncementTaskKey, out var row))
                return false;
            return row.TryGetProperty(typeId, out var allowed) && allowed.ValueKind == JsonValueKind.True;
        }
        catch
        {
            return false;
        }
    }

    sealed record EmployeeContext(int EmployeeId, int CompanyId, AppUser? AppUser);
}

public class TeamChatStartDirectRequest
{
    public int EmployeeId { get; set; }
    public int PeerEmployeeId { get; set; }
}

public class TeamChatPostMessageRequest
{
    public int EmployeeId { get; set; }
    public string? Body { get; set; }
    public string? AttachmentBase64 { get; set; }
    public string? AttachmentContentType { get; set; }
}
