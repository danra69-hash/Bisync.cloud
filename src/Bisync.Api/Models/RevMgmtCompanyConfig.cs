namespace Bisync.Api.Models;

public class RevMgmtCompanyConfig
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string ConfigKey { get; set; } = string.Empty;
    public string StateJson { get; set; } = "{}";
    public DateTime UpdatedAt { get; set; }
}
