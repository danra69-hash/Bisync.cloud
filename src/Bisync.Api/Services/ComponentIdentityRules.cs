using System.Text;
using System.Text.RegularExpressions;

namespace Bisync.Api.Services;

/// <summary>
/// Permanent component identity rules:
/// - Names are unique per company (locations inherit company catalog).
/// - Normalized uniqueness collapses case and repeated spaces.
/// - Allowed characters: letters, digits, single spaces between words, and dash.
/// - Component IDs are {COMPANY_CODE}-{4 uppercase alphanumeric chars with letter+digit}.
/// </summary>
public static partial class ComponentIdentityRules
{
    public const int CompanyCodeLength = 4;
    public const int ComponentSuffixLength = 4;

    static readonly Regex AllowedNamePattern = AllowedNameRegex();
    static readonly Regex AllowedIdPattern = AllowedIdRegex();

    public static string NormalizeName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return string.Empty;

        var cleaned = new StringBuilder(raw.Length);
        var previousWasSpace = false;
        foreach (var ch in raw.Trim())
        {
            if (char.IsLetterOrDigit(ch) || ch == '-')
            {
                cleaned.Append(ch);
                previousWasSpace = false;
                continue;
            }

            if (char.IsWhiteSpace(ch))
            {
                if (previousWasSpace || cleaned.Length == 0)
                    continue;
                cleaned.Append(' ');
                previousWasSpace = true;
            }
            // Drop every other character (punctuation, symbols, underscores, etc.).
        }

        return cleaned.ToString().Trim();
    }

    public static string NormalizeNameKey(string? raw)
        => NormalizeName(raw).ToLowerInvariant();

    public static bool IsValidName(string? raw)
    {
        var normalized = NormalizeName(raw);
        if (normalized.Length == 0)
            return false;
        if (!string.Equals(raw?.Trim(), normalized, StringComparison.Ordinal))
            return false;
        return AllowedNamePattern.IsMatch(normalized);
    }

    public static string? ValidateName(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return "Component name is required.";

        var normalized = NormalizeName(raw);
        if (normalized.Length == 0)
            return "Component name must contain letters or numbers.";

        if (!string.Equals(raw.Trim(), normalized, StringComparison.Ordinal))
            return "Component name allows only letters, numbers, a single space between words, and - (dash).";

        if (!AllowedNamePattern.IsMatch(normalized))
            return "Component name allows only letters, numbers, a single space between words, and - (dash).";

        return null;
    }

    public static bool IsValidComponentId(string? componentId, string? companyCode = null)
    {
        if (string.IsNullOrWhiteSpace(componentId))
            return false;
        if (!AllowedIdPattern.IsMatch(componentId))
            return false;

        if (!string.IsNullOrWhiteSpace(companyCode))
        {
            var expectedPrefix = companyCode.Trim().ToUpperInvariant() + "-";
            if (!componentId.StartsWith(expectedPrefix, StringComparison.Ordinal))
                return false;
        }

        var suffix = componentId[^ComponentSuffixLength..];
        return suffix.Any(char.IsLetter) && suffix.Any(char.IsDigit);
    }

    public static string DeriveCompanyCodeCandidate(string? companyName)
    {
        var letters = new string((companyName ?? string.Empty)
            .Where(char.IsLetter)
            .Select(char.ToUpperInvariant)
            .ToArray());

        if (letters.Length >= CompanyCodeLength)
            return letters[..CompanyCodeLength];

        return letters.PadRight(CompanyCodeLength, 'X');
    }

    public static string AllocateUniqueCompanyCode(
        string? companyName,
        IReadOnlyCollection<string> existingCodes,
        int companyIdHint = 0)
    {
        var used = new HashSet<string>(
            existingCodes.Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim().ToUpperInvariant()),
            StringComparer.Ordinal);

        var primary = DeriveCompanyCodeCandidate(companyName);
        if (used.Add(primary))
            return primary;

        // Prefer letter variations when multiple companies share a name root (e.g. Bisync*).
        for (var letter = 'A'; letter <= 'Z'; letter++)
        {
            var candidate = primary[..3] + letter;
            if (used.Add(candidate))
                return candidate;
        }

        for (var digit = '0'; digit <= '9'; digit++)
        {
            var candidate = primary[..3] + digit;
            if (used.Add(candidate))
                return candidate;
        }

        var fallbackSeed = companyIdHint > 0
            ? companyIdHint.ToString("X")
            : Guid.NewGuid().ToString("N");
        var fallback = ("C" + fallbackSeed.ToUpperInvariant()).PadRight(CompanyCodeLength, 'X')[..CompanyCodeLength];
        var n = 0;
        while (!used.Add(fallback))
        {
            n++;
            fallback = ("C" + (fallbackSeed + n).ToUpperInvariant()).PadRight(CompanyCodeLength, 'X')[..CompanyCodeLength];
        }

        return fallback;
    }

    public static string GenerateSuffix(IReadOnlyCollection<string> existingFullIds, string companyCode)
    {
        var prefix = companyCode.Trim().ToUpperInvariant() + "-";
        var usedSuffixes = new HashSet<string>(StringComparer.Ordinal);
        foreach (var id in existingFullIds)
        {
            if (id.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) && id.Length == prefix.Length + ComponentSuffixLength)
                usedSuffixes.Add(id[^ComponentSuffixLength..].ToUpperInvariant());
        }

        // Prefer sequential letter+digit mixes: A001, A002, ... Z999, then B001, etc.
        for (var letter = 'A'; letter <= 'Z'; letter++)
        {
            for (var n = 1; n <= 999; n++)
            {
                var suffix = $"{letter}{n:D3}";
                if (usedSuffixes.Add(suffix))
                    return suffix;
            }
        }

        // Exhaustion fallback.
        while (true)
        {
            var suffix = Guid.NewGuid().ToString("N")[..ComponentSuffixLength].ToUpperInvariant();
            if (!suffix.Any(char.IsLetter) || !suffix.Any(char.IsDigit))
                continue;
            if (usedSuffixes.Add(suffix))
                return suffix;
        }
    }

    public static string BuildComponentId(string companyCode, string suffix)
        => $"{companyCode.Trim().ToUpperInvariant()}-{suffix.Trim().ToUpperInvariant()}";

    [GeneratedRegex(@"^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex AllowedNameRegex();

    [GeneratedRegex(@"^[A-Z]{4}-[A-Z0-9]{4}$", RegexOptions.CultureInvariant)]
    private static partial Regex AllowedIdRegex();
}
