namespace Bisync.Api.Models;

/// <summary>Sales Module CRM customer the logged-in user is engaged with.</summary>
public class SalesModuleCustomer
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    /// <summary>JSON array of { "name": string, "count": number }.</summary>
    public string BrandsJson { get; set; } = "[]";
    /// <summary>JSON array of contacts { id, name, position, email, mobile }.</summary>
    public string ContactsJson { get; set; } = "[]";
    public string Status { get; set; } = "Prospect";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastContactDate { get; set; }
    public string LastDiscussionBrief { get; set; } = string.Empty;
    /// <summary>User id of the sales person engaged to this customer.</summary>
    public int EngagedUserId { get; set; }
    public string EngagedUserEmail { get; set; } = string.Empty;
    public string EngagedUserName { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
}

/// <summary>Appointment booked against a Sales Module customer.</summary>
public class SalesModuleAppointment
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int SalesModuleCustomerId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string Location { get; set; } = string.Empty;
    public int EngagedUserId { get; set; }
    public string EngagedUserEmail { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
