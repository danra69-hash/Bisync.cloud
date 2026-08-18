using System.Globalization;
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

        var projectTasks = await db.TeamProjectTasks.AsNoTracking()
            .Where(t => allIds.Contains(t.ConversationId))
            .ToListAsync();
        var projectProgressByConv = projectTasks
            .GroupBy(t => t.ConversationId)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var total = g.Count();
                    var completed = g.Count(t => t.Completed);
                    var percent = total == 0 ? 0 : (int)Math.Round(100.0 * completed / total);
                    return new { total, completed, percent };
                });

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
            var title = ResolveConversationTitle(c, peerNames);
            projectProgressByConv.TryGetValue(c.Id, out var progress);

            return new
            {
                c.Id,
                c.CompanyId,
                c.Type,
                title,
                c.UpdatedAt,
                unreadCount = unread,
                peerEmployeeIds = peerIds,
                projectStartDate = c.ProjectStartDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                projectTargetDate = c.ProjectTargetDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                projectProgress = c.Type == "project" ? progress : null,
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

        object? project = null;
        if (conversation.Type == "project")
            project = await BuildProjectPayloadAsync(conversation);

        var memberIds = await db.TeamConversationMembers.AsNoTracking()
            .Where(m => m.ConversationId == id)
            .Select(m => m.EmployeeId)
            .ToListAsync();
        var peerNames = await db.Employees.AsNoTracking()
            .Where(e => memberIds.Contains(e.Id) && e.Id != employeeId)
            .Select(e => e.Name)
            .ToListAsync();

        return Ok(new
        {
            conversation = new
            {
                conversation.Id,
                conversation.Type,
                title = ResolveConversationTitle(conversation, peerNames),
                canSend = conversation.Type != "announcement" || await CanSendAnnouncementAsync(employeeId),
                projectStartDate = conversation.ProjectStartDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                projectTargetDate = conversation.ProjectTargetDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            },
            project,
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

    [HttpPost("conversations/group")]
    public async Task<ActionResult<object>> StartGroup([FromBody] TeamChatStartGroupRequest request)
    {
        if (request.EmployeeId <= 0)
            return BadRequest(new { message = "employeeId is required." });
        var title = (request.Title ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(title))
            return BadRequest(new { message = "Group name is required." });
        if (title.Length > 200)
            return BadRequest(new { message = "Group name is too long." });

        var memberIds = (request.MemberEmployeeIds ?? [])
            .Where(id => id > 0 && id != request.EmployeeId)
            .Distinct()
            .ToList();
        if (memberIds.Count == 0)
            return BadRequest(new { message = "Select at least one other person for the group chat." });

        var ctx = await ResolveEmployeeContextAsync(request.EmployeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });

        var companyEmployeeIds = await CompanyEmployeeIdsAsync(ctx.CompanyId);
        var validMembers = await db.Employees.AsNoTracking()
            .Where(e => e.Active && memberIds.Contains(e.Id))
            .Select(e => e.Id)
            .ToListAsync();
        if (companyEmployeeIds.Count > 0)
            validMembers = validMembers.Where(companyEmployeeIds.Contains).ToList();
        if (validMembers.Count == 0)
            return BadRequest(new { message = "No valid members found in your company directory." });

        var now = DateTime.UtcNow;
        var conversation = new TeamConversation
        {
            CompanyId = ctx.CompanyId,
            Type = "group",
            Title = title,
            CreatedByEmployeeId = request.EmployeeId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.TeamConversations.Add(conversation);
        await db.SaveChangesAsync();

        var allMemberIds = validMembers.Append(request.EmployeeId).Distinct().ToList();
        foreach (var empId in allMemberIds)
        {
            db.TeamConversationMembers.Add(new TeamConversationMember
            {
                ConversationId = conversation.Id,
                EmployeeId = empId,
                JoinedAt = now,
                LastReadAt = empId == request.EmployeeId ? now : null,
            });
        }

        db.TeamChatMessages.Add(new TeamChatMessage
        {
            ConversationId = conversation.Id,
            SenderEmployeeId = request.EmployeeId,
            Body = $"Created group “{title}”.",
            CreatedAt = now,
        });
        await db.SaveChangesAsync();

        return Ok(new { id = conversation.Id, type = conversation.Type, title = conversation.Title, created = true });
    }

    [HttpPost("conversations/project")]
    public async Task<ActionResult<object>> StartProject([FromBody] TeamChatStartProjectRequest request)
    {
        if (request.EmployeeId <= 0)
            return BadRequest(new { message = "employeeId is required." });

        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Project name is required." });
        if (name.Length > 200)
            return BadRequest(new { message = "Project name is too long." });

        if (!TryParseDateOnly(request.StartDate, out var startDate))
            return BadRequest(new { message = "Start date is required (YYYY-MM-DD)." });
        if (!TryParseDateOnly(request.TargetCompletionDate, out var targetDate))
            return BadRequest(new { message = "Target completion date is required (YYYY-MM-DD)." });
        if (targetDate < startDate)
            return BadRequest(new { message = "Target completion date must be on or after the start date." });

        var tasks = (request.Tasks ?? [])
            .Select(t => new
            {
                Title = (t.Title ?? string.Empty).Trim(),
                Assignees = (t.AssigneeEmployeeIds ?? []).Where(id => id > 0).Distinct().ToList(),
            })
            .Where(t => !string.IsNullOrWhiteSpace(t.Title))
            .ToList();
        if (tasks.Count == 0)
            return BadRequest(new { message = "Add at least one task with a title." });

        var ctx = await ResolveEmployeeContextAsync(request.EmployeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });

        var companyEmployeeIds = await CompanyEmployeeIdsAsync(ctx.CompanyId);
        var taggedIds = tasks.SelectMany(t => t.Assignees)
            .Concat(request.MemberEmployeeIds ?? [])
            .Where(id => id > 0 && id != request.EmployeeId)
            .Distinct()
            .ToList();

        var validMembers = await db.Employees.AsNoTracking()
            .Where(e => e.Active && taggedIds.Contains(e.Id))
            .Select(e => e.Id)
            .ToListAsync();
        if (companyEmployeeIds.Count > 0)
            validMembers = validMembers.Where(companyEmployeeIds.Contains).ToList();

        var validSet = validMembers.ToHashSet();
        validSet.Add(request.EmployeeId);

        var now = DateTime.UtcNow;
        var conversation = new TeamConversation
        {
            CompanyId = ctx.CompanyId,
            Type = "project",
            Title = name,
            CreatedByEmployeeId = request.EmployeeId,
            ProjectStartDate = startDate,
            ProjectTargetDate = targetDate,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.TeamConversations.Add(conversation);
        await db.SaveChangesAsync();

        foreach (var empId in validSet)
        {
            db.TeamConversationMembers.Add(new TeamConversationMember
            {
                ConversationId = conversation.Id,
                EmployeeId = empId,
                JoinedAt = now,
                LastReadAt = empId == request.EmployeeId ? now : null,
            });
        }

        var sort = 0;
        foreach (var task in tasks)
        {
            var assignees = task.Assignees.Where(validSet.Contains).Distinct().ToList();
            db.TeamProjectTasks.Add(new TeamProjectTask
            {
                ConversationId = conversation.Id,
                Title = task.Title,
                SortOrder = sort++,
                Completed = false,
                AssigneeEmployeeIdsJson = JsonSerializer.Serialize(assignees),
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        db.TeamChatMessages.Add(new TeamChatMessage
        {
            ConversationId = conversation.Id,
            SenderEmployeeId = request.EmployeeId,
            Body = $"Created project “{name}” ({startDate:yyyy-MM-dd} → {targetDate:yyyy-MM-dd}) with {tasks.Count} task(s).",
            CreatedAt = now,
        });
        await db.SaveChangesAsync();

        var project = await BuildProjectPayloadAsync(conversation);
        return Ok(new
        {
            id = conversation.Id,
            type = conversation.Type,
            title = conversation.Title,
            created = true,
            project,
        });
    }

    [HttpPatch("conversations/{id:int}/project/tasks/{taskId:int}")]
    public async Task<ActionResult<object>> SetProjectTaskCompleted(
        int id,
        int taskId,
        [FromBody] TeamChatSetTaskCompletedRequest request)
    {
        if (request.EmployeeId <= 0)
            return BadRequest(new { message = "employeeId is required." });

        var ctx = await ResolveEmployeeContextAsync(request.EmployeeId);
        if (ctx is null) return NotFound(new { message = "Employee not found." });

        var conversation = await db.TeamConversations.FirstOrDefaultAsync(c => c.Id == id);
        if (conversation is null) return NotFound(new { message = "Conversation not found." });
        if (conversation.Type != "project")
            return BadRequest(new { message = "Conversation is not a project." });
        if (conversation.CompanyId != ctx.CompanyId)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Conversation is outside your company." });

        var isMember = await db.TeamConversationMembers
            .AnyAsync(m => m.ConversationId == id && m.EmployeeId == request.EmployeeId);
        if (!isMember)
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You are not a member of this project." });

        var task = await db.TeamProjectTasks.FirstOrDefaultAsync(t => t.Id == taskId && t.ConversationId == id);
        if (task is null) return NotFound(new { message = "Task not found." });

        task.Completed = request.Completed;
        task.UpdatedAt = DateTime.UtcNow;
        conversation.UpdatedAt = task.UpdatedAt;
        await db.SaveChangesAsync();

        return Ok(await BuildProjectPayloadAsync(conversation));
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

    static string ResolveConversationTitle(TeamConversation conversation, IReadOnlyList<string> peerNames)
    {
        if (conversation.Type == "announcement")
            return string.IsNullOrWhiteSpace(conversation.Title) ? "Company Announcement" : conversation.Title;
        if (conversation.Type is "group" or "project")
            return string.IsNullOrWhiteSpace(conversation.Title) ? (conversation.Type == "project" ? "Project" : "Group chat") : conversation.Title;
        if (peerNames.Count > 0)
            return string.Join(", ", peerNames);
        return string.IsNullOrWhiteSpace(conversation.Title) ? "Conversation" : conversation.Title;
    }

    static bool TryParseDateOnly(string? value, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(value)) return false;
        return DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date)
            || DateOnly.TryParse(value.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    static List<int> ParseAssigneeIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            var ids = JsonSerializer.Deserialize<List<int>>(json, JsonOptions);
            return ids?.Where(id => id > 0).Distinct().ToList() ?? [];
        }
        catch
        {
            return [];
        }
    }

    async Task<object> BuildProjectPayloadAsync(TeamConversation conversation)
    {
        var tasks = await db.TeamProjectTasks.AsNoTracking()
            .Where(t => t.ConversationId == conversation.Id)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Id)
            .ToListAsync();
        var assigneeIds = tasks.SelectMany(t => ParseAssigneeIds(t.AssigneeEmployeeIdsJson)).Distinct().ToList();
        var names = await db.Employees.AsNoTracking()
            .Where(e => assigneeIds.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.Name);

        var total = tasks.Count;
        var completed = tasks.Count(t => t.Completed);
        var percent = total == 0 ? 0 : (int)Math.Round(100.0 * completed / total);

        return new
        {
            name = conversation.Title,
            startDate = conversation.ProjectStartDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            targetCompletionDate = conversation.ProjectTargetDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            progress = new { total, completed, percent },
            tasks = tasks.Select(t =>
            {
                var ids = ParseAssigneeIds(t.AssigneeEmployeeIdsJson);
                return new
                {
                    t.Id,
                    t.Title,
                    t.SortOrder,
                    t.Completed,
                    assigneeEmployeeIds = ids,
                    assigneeNames = ids.Select(id => names.TryGetValue(id, out var n) ? n : $"#{id}").ToList(),
                };
            }),
        };
    }

    sealed record EmployeeContext(int EmployeeId, int CompanyId, AppUser? AppUser);
}

public class TeamChatStartDirectRequest
{
    public int EmployeeId { get; set; }
    public int PeerEmployeeId { get; set; }
}

public class TeamChatStartGroupRequest
{
    public int EmployeeId { get; set; }
    public string? Title { get; set; }
    public List<int>? MemberEmployeeIds { get; set; }
}

public class TeamChatStartProjectRequest
{
    public int EmployeeId { get; set; }
    public string? Name { get; set; }
    public string? StartDate { get; set; }
    public string? TargetCompletionDate { get; set; }
    public List<int>? MemberEmployeeIds { get; set; }
    public List<TeamChatProjectTaskInput>? Tasks { get; set; }
}

public class TeamChatProjectTaskInput
{
    public string? Title { get; set; }
    public List<int>? AssigneeEmployeeIds { get; set; }
}

public class TeamChatSetTaskCompletedRequest
{
    public int EmployeeId { get; set; }
    public bool Completed { get; set; }
}

public class TeamChatPostMessageRequest
{
    public int EmployeeId { get; set; }
    public string? Body { get; set; }
    public string? AttachmentBase64 { get; set; }
    public string? AttachmentContentType { get; set; }
}
