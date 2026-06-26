namespace Bisync.Api.Models;

public class PayrollRun
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public Company? Company { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public string PayCycle { get; set; } = "Monthly";
    public string PayType { get; set; } = "Fixed Salary";
    public string CountryCode { get; set; } = "MY";
    public string PeriodLabel { get; set; } = "";
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public DateTime ProcessedAt { get; set; }
    public decimal TotalGross { get; set; }
    public decimal TotalPayout { get; set; }
    public int EmployeeCount { get; set; }
    public List<PayrollRunLine> Lines { get; set; } = [];
}

public class PayrollRunLine
{
    public int Id { get; set; }
    public int PayrollRunId { get; set; }
    public PayrollRun? PayrollRun { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = "";
    public string EmployeeName { get; set; } = "";
    public string Department { get; set; } = "";
    public string Position { get; set; } = "";
    public decimal PresentDays { get; set; }
    public decimal WorkingDays { get; set; }
    public decimal TotalHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal AttendanceRatio { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal ServiceAllowance { get; set; }
    public decimal AccommodationAllowance { get; set; }
    public decimal TransportAllowance { get; set; }
    public decimal MobileAllowance { get; set; }
    public decimal BonusAmount { get; set; }
    public decimal OvertimeAmount { get; set; }
    public decimal EpfEmployeeAmount { get; set; }
    public decimal EpfEmployerAmount { get; set; }
    public decimal SocsoEmployeeAmount { get; set; }
    public decimal SocsoEmployerAmount { get; set; }
    public decimal IncomeTaxAmount { get; set; }
    public decimal GrossPay { get; set; }
    public decimal TotalPayout { get; set; }
}
