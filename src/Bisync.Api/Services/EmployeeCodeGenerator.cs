using Bisync.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Services;

public static class EmployeeCodeGenerator
{
    public const int MinDigits = 6;

    public static async Task<string> NextCodeAsync(BisyncDbContext db, CancellationToken cancellationToken = default)
    {
        var codes = await db.Employees.AsNoTracking().Select(e => e.EmployeeCode).ToListAsync(cancellationToken);
        var max = 0L;
        foreach (var code in codes)
        {
            var digits = new string(code.Where(char.IsDigit).ToArray());
            if (digits.Length > 0 && long.TryParse(digits, out var value))
                max = Math.Max(max, value);
        }

        return (max + 1).ToString().PadLeft(MinDigits, '0');
    }
}
