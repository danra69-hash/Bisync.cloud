namespace Bisync.Api.Services;

/// <summary>
/// Platform decimal rules for persisted numbers:
/// always 4 decimal places (0.0000); the 5th digit rounds AwayFromZero.
/// UI display (2–4 smart decimals) lives on the client.
/// </summary>
public static class DecimalRounding
{
    public const int DbScale = 4;

    public static decimal ToDb(decimal value) =>
        Math.Round(value, DbScale, MidpointRounding.AwayFromZero);

    public static decimal? ToDb(decimal? value) =>
        value is null ? null : ToDb(value.Value);
}
