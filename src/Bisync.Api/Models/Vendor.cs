namespace Bisync.Api.Models;

public class Vendor
{
    public int Id { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "offline";
    public string Brn { get; set; } = string.Empty;
    public string Products { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactPosition { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string ContactsJson { get; set; } = "[]";
    public bool Engaged { get; set; }
}
