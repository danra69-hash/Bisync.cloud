using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class VendorEngagementService
{
    public const string StatusNone = "none";
    public const string StatusPending = "pending";
    public const string StatusApproved = "approved";
    public const string StatusRejected = "rejected";

    public const string PaymentCod = "cod";
    public const string PaymentPrepaid = "prepaid";
    public const string PaymentPostpaid = "postpaid";

    public static readonly HashSet<string> ValidPaymentTerms = new(StringComparer.OrdinalIgnoreCase)
    {
        PaymentCod, PaymentPrepaid, PaymentPostpaid,
    };

    public static bool IsOnlineVendor(Vendor vendor) =>
        string.Equals(vendor.Type?.Trim(), "online", StringComparison.OrdinalIgnoreCase);

    public static bool IsFullyEngaged(Vendor vendor) =>
        vendor.Engaged
        && (!IsOnlineVendor(vendor)
            || string.Equals(vendor.EngagementStatus, StatusApproved, StringComparison.OrdinalIgnoreCase));

    public static async Task<int?> ResolveLinkedCompanyIdAsync(BisyncDbContext db, Vendor vendor)
    {
        if (vendor.LinkedCompanyId is int linked && linked > 0)
            return linked;

        var brn = vendor.Brn?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(brn))
            return null;

        var company = await db.Companies.AsNoTracking()
            .Where(c => c.Active && c.Brn.ToLower() == brn.ToLower())
            .OrderBy(c => c.Id)
            .FirstOrDefaultAsync();
        return company?.Id;
    }

    public static string? ValidatePaymentTerms(string? paymentTerms)
    {
        var value = paymentTerms?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(value))
            return "Payment terms are required (COD, Prepaid, or Postpaid).";
        if (!ValidPaymentTerms.Contains(value))
            return "Payment terms must be COD, Prepaid, or Postpaid.";
        return null;
    }

    public static string NormalizePaymentTerms(string paymentTerms) =>
        paymentTerms.Trim().ToLowerInvariant();

    public static object MapEngagement(Vendor vendor) => new
    {
        vendor.Id,
        vendor.ExternalId,
        vendor.Name,
        vendor.Type,
        vendor.Brn,
        vendor.Engaged,
        engagementStatus = string.IsNullOrWhiteSpace(vendor.EngagementStatus) ? StatusNone : vendor.EngagementStatus,
        linkedCompanyId = vendor.LinkedCompanyId,
        minOrderAmount = vendor.MinOrderAmount,
        deliveryChargeBelowMin = vendor.DeliveryChargeBelowMin,
        paymentTerms = vendor.PaymentTerms,
        engageRequestedAt = vendor.EngageRequestedAt,
        engageRequestedBy = vendor.EngageRequestedBy,
        engageApprovedAt = vendor.EngageApprovedAt,
        engageApprovedBy = vendor.EngageApprovedBy,
        contactPerson = vendor.ContactPerson,
        mobile = vendor.Mobile,
        email = vendor.Email,
        companyId = vendor.CompanyId,
    };
}
