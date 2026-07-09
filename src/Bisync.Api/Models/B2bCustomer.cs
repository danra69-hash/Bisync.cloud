namespace Bisync.Api.Models;

public class B2bCustomer
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string Brn { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Postcode { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Fax { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string ContactsJson { get; set; } = "[]";
    public string TaggedProductIdsJson { get; set; } = "[]";
    public string TaggedProductAliasIdsJson { get; set; } = "[]";
    public string TaggedB2bProductUnitsJson { get; set; } = "[]";
    public string PurchaseHistoryJson { get; set; } = "[]";
    public bool Active { get; set; } = true;
}
