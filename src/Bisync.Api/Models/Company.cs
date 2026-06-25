namespace Bisync.Api.Models;

public class Company
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Brn { get; set; } = string.Empty;
    public string GstTin { get; set; } = string.Empty;
    public string CountryCode { get; set; } = "MY";
    public string AddressLine1 { get; set; } = string.Empty;
    public string AddressLine2 { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string StateProvince { get; set; } = string.Empty;
    public string Postcode { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Fax { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public ICollection<Location> Locations { get; set; } = new List<Location>();
}
