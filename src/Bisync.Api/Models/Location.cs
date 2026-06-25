namespace Bisync.Api.Models;

public class Location
{
    public int Id { get; set; }
    public string ExternalId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public decimal SalesToday { get; set; }
    public decimal SalesWtd { get; set; }
    public decimal SalesMtd { get; set; }
    public decimal SalesYtd { get; set; }
    public decimal SalesPrevToday { get; set; }
    public decimal SalesPrevWtd { get; set; }
    public decimal SalesPrevMtd { get; set; }
    public decimal SalesPrevYtd { get; set; }
    public int CoversToday { get; set; }
    public int CoversWtd { get; set; }
    public int CoversMtd { get; set; }
    public int CoversYtd { get; set; }
    public int CoversPrevToday { get; set; }
    public int CoversPrevWtd { get; set; }
    public int CoversPrevMtd { get; set; }
    public int CoversPrevYtd { get; set; }
    public int ChecksToday { get; set; }
    public int ChecksWtd { get; set; }
    public int ChecksMtd { get; set; }
    public int ChecksYtd { get; set; }
    public int ChecksPrevToday { get; set; }
    public int ChecksPrevWtd { get; set; }
    public int ChecksPrevMtd { get; set; }
    public int ChecksPrevYtd { get; set; }
}
