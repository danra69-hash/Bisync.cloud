namespace Bisync.Api.Models;

/// <summary>
/// CRM company created inside Dev Console Sales Module (not a Bisync tenant).
/// Tagged to one or more Sales Team members who own / work that account.
/// </summary>
public class SalesModuleCompany
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string CreatedByEmail { get; set; } = string.Empty;
}

/// <summary>Tags a Sales Module company to a Sales Team member.</summary>
public class SalesModuleCompanyMember
{
    public int Id { get; set; }
    public int SalesModuleCompanyId { get; set; }
    public int SalesTeamMemberId { get; set; }
}
