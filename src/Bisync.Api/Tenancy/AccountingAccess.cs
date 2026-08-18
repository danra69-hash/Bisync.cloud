using Microsoft.AspNetCore.Mvc;

namespace Bisync.Api.Tenancy;

/// <summary>
/// Books / ledger API gate: signed-in user required; company comes from the
/// verified tenant, not a client-supplied query string.
/// </summary>
public static class AccountingAccess
{
    public static bool TryResolve(
        ITenantContext tenant,
        int? requestedCompanyId,
        out int companyId,
        out string actor,
        out ActionResult? error)
    {
        companyId = 0;
        actor = "";
        error = null;

        if (tenant.UserId is not > 0)
        {
            error = new UnauthorizedObjectResult(new { message = "Sign in required for Books." });
            return false;
        }

        actor = $"user:{tenant.UserId.Value}";

        if (!tenant.IsPlatformAdmin)
        {
            if (tenant.CompanyId is not > 0)
            {
                error = new BadRequestObjectResult(new { message = "Company context required." });
                return false;
            }

            if (requestedCompanyId is > 0 && requestedCompanyId != tenant.CompanyId)
            {
                error = new ObjectResult(new { message = "Company does not match your signed-in tenant." })
                {
                    StatusCode = StatusCodes.Status403Forbidden,
                };
                return false;
            }

            companyId = tenant.CompanyId.Value;
            return true;
        }

        var cid = requestedCompanyId is > 0 ? requestedCompanyId : tenant.CompanyId;
        if (cid is not > 0)
        {
            error = new BadRequestObjectResult(new { message = "Company context required." });
            return false;
        }

        companyId = cid.Value;
        return true;
    }
}
