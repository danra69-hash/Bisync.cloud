namespace Bisync.Api.Models;

public class PosCustomer
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Postcode { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Fax { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string LoyaltySummaryJson { get; set; } = "[]";
    public string CouponSummaryJson { get; set; } = "[]";
    public string ActivityHistoryJson { get; set; } = "[]";
    public bool Active { get; set; } = true;
}
