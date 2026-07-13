namespace Bisync.Api.Tenancy;

public class TenancyOptions
{
    public const string SectionName = "Tenancy";

    /// <summary>
    /// When true, self-serve companies get a dedicated operational + archive database after payment/provision.
    /// </summary>
    public bool ProvisionCompanyDatabases { get; set; } = true;
}
