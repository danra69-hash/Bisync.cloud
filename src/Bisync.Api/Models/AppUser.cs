namespace Bisync.Api.Models;

public class AppUser
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public string AccessJson { get; set; } = """{"modules":[]}""";
    public int? CompanyId { get; set; }
    public Company? Company { get; set; }
    public string LocationIdsJson { get; set; } = "[]";
}
