namespace Bisync.Api.Models;

/// <summary>direct | announcement | group | project</summary>
public class TeamConversation
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Type { get; set; } = "direct";
    public string Title { get; set; } = string.Empty;
    public int? CreatedByEmployeeId { get; set; }
    public DateOnly? ProjectStartDate { get; set; }
    public DateOnly? ProjectTargetDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public List<TeamConversationMember> Members { get; set; } = [];
    public List<TeamChatMessage> Messages { get; set; } = [];
    public List<TeamProjectTask> ProjectTasks { get; set; } = [];
}

public class TeamConversationMember
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public TeamConversation? Conversation { get; set; }
    public int EmployeeId { get; set; }
    public Employee? Employee { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastReadAt { get; set; }
}

public class TeamChatMessage
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public TeamConversation? Conversation { get; set; }
    public int SenderEmployeeId { get; set; }
    public Employee? Sender { get; set; }
    public string Body { get; set; } = string.Empty;
    /// <summary>Optional image/screenshot payload (base64, no data: prefix).</summary>
    public string AttachmentBase64 { get; set; } = string.Empty;
    public string AttachmentContentType { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class TeamProjectTask
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public TeamConversation? Conversation { get; set; }
    public string Title { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool Completed { get; set; }
    /// <summary>JSON array of employee ids tagged on this task.</summary>
    public string AssigneeEmployeeIdsJson { get; set; } = "[]";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
