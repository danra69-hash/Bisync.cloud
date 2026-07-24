namespace Bisync.Api.Services;

/// <summary>
/// Platform decimal rules for persisted / cost numbers:
/// 4 decimal places; 5th digit AwayFromZero.
/// Matches Bisync STOCK Analyzer unit-price display (4dp).
/// </summary>
public static class DecimalRounding
{
    public const int DbScale = 4;

    public static decimal ToDb(decimal value) =>
        Math.Round(value, DbScale, MidpointRounding.AwayFromZero);

    public static decimal? ToDb(decimal? value) =>
        value is null ? null : ToDb(value.Value);
}
