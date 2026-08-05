using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/pos-config-types")]
public class PosConfigTypesController(BisyncDbContext db) : ControllerBase
{
    public static readonly string[] ValidKinds = ["payment", "entertainment", "discount"];

    static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public record UpsertRequest(
        int CompanyId,
        string Kind,
        string Name,
        string Code,
        int Sequence = 0,
        bool Active = true,
        bool IncludeAll = false,
        string[]? ExceptionGroups = null,
        int[]? ExceptionProductIds = null);

    public record ActiveBody(bool Active);

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> List(
        [FromQuery] int companyId,
        [FromQuery] string? kind,
        [FromQuery] bool includeInactive = true,
        CancellationToken cancellationToken = default)
    {
        if (companyId <= 0)
            return BadRequest(new { message = "companyId is required." });

        await EnsureDefaultsAsync(companyId, cancellationToken);

        var q = db.PosConfigTypes.AsNoTracking()
            .Where(r => r.CompanyId == companyId);

        if (!includeInactive)
            q = q.Where(r => r.Active);

        if (!string.IsNullOrWhiteSpace(kind))
        {
            var k = kind.Trim().ToLowerInvariant();
            if (!ValidKinds.Contains(k))
                return BadRequest(new { message = $"kind must be one of: {string.Join(", ", ValidKinds)}" });
            q = q.Where(r => r.Kind == k);
        }

        var rows = await q
            .OrderBy(r => r.Kind)
            .ThenBy(r => r.Sequence)
            .ThenBy(r => r.Name)
            .ToListAsync(cancellationToken);

        return Ok(rows.Select(Map));
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create(
        [FromBody] UpsertRequest body,
        CancellationToken cancellationToken = default)
    {
        var error = Validate(body);
        if (error is not null)
            return BadRequest(new { message = error });

        var kind = body.Kind.Trim().ToLowerInvariant();
        var code = NormalizeCode(body.Code);
        var name = body.Name.Trim();

        var clash = await db.PosConfigTypes.AnyAsync(
            r => r.CompanyId == body.CompanyId
                && r.Kind == kind
                && r.Code.ToLower() == code.ToLower(),
            cancellationToken);
        if (clash)
            return BadRequest(new { message = $"Code '{code}' already exists for this {kind} type." });

        var now = DateTime.UtcNow;
        var row = new PosConfigType
        {
            CompanyId = body.CompanyId,
            Kind = kind,
            Name = name,
            Code = code,
            Sequence = Math.Max(0, body.Sequence),
            Active = body.Active,
            CreatedAt = now,
            UpdatedAt = now,
        };
        ApplyEntertainmentFields(row, kind, body);
        db.PosConfigTypes.Add(row);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(Map(row));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<object>> Update(
        int id,
        [FromBody] UpsertRequest body,
        CancellationToken cancellationToken = default)
    {
        var error = Validate(body);
        if (error is not null)
            return BadRequest(new { message = error });

        var row = await db.PosConfigTypes.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "config type not found." });
        if (row.CompanyId != body.CompanyId)
            return BadRequest(new { message = "companyId mismatch." });

        var kind = body.Kind.Trim().ToLowerInvariant();
        var code = NormalizeCode(body.Code);
        var name = body.Name.Trim();

        var clash = await db.PosConfigTypes.AnyAsync(
            r => r.Id != id
                && r.CompanyId == body.CompanyId
                && r.Kind == kind
                && r.Code.ToLower() == code.ToLower(),
            cancellationToken);
        if (clash)
            return BadRequest(new { message = $"Code '{code}' already exists for this {kind} type." });

        row.Kind = kind;
        row.Name = name;
        row.Code = code;
        row.Sequence = Math.Max(0, body.Sequence);
        row.Active = body.Active;
        ApplyEntertainmentFields(row, kind, body);
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(Map(row));
    }

    [HttpPatch("{id:int}/active")]
    public async Task<ActionResult<object>> SetActive(
        int id,
        [FromBody] ActiveBody body,
        CancellationToken cancellationToken = default)
    {
        var row = await db.PosConfigTypes.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "config type not found." });
        row.Active = body.Active;
        row.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(Map(row));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id, CancellationToken cancellationToken = default)
    {
        var row = await db.PosConfigTypes.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (row is null)
            return NotFound(new { message = "config type not found." });
        db.PosConfigTypes.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    static void ApplyEntertainmentFields(PosConfigType row, string kind, UpsertRequest body)
    {
        if (kind != "entertainment")
        {
            row.IncludeAll = false;
            row.ExceptionGroupsJson = "[]";
            row.ExceptionProductIdsJson = "[]";
            return;
        }

        row.IncludeAll = body.IncludeAll;
        if (body.IncludeAll)
        {
            // Include-all overrides exceptions — persist empty lists for clarity.
            row.ExceptionGroupsJson = "[]";
            row.ExceptionProductIdsJson = "[]";
            return;
        }

        var groups = (body.ExceptionGroups ?? [])
            .Select(g => (g ?? string.Empty).Trim())
            .Where(g => g.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(g => g, StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var productIds = (body.ExceptionProductIds ?? [])
            .Where(id => id > 0)
            .Distinct()
            .OrderBy(id => id)
            .ToArray();

        row.ExceptionGroupsJson = JsonSerializer.Serialize(groups, JsonOpts);
        row.ExceptionProductIdsJson = JsonSerializer.Serialize(productIds, JsonOpts);
    }

    static string? Validate(UpsertRequest body)
    {
        if (body.CompanyId <= 0)
            return "companyId is required.";
        var kind = (body.Kind ?? string.Empty).Trim().ToLowerInvariant();
        if (!ValidKinds.Contains(kind))
            return $"kind must be one of: {string.Join(", ", ValidKinds)}";
        if (string.IsNullOrWhiteSpace(body.Name))
            return "name is required.";
        if (string.IsNullOrWhiteSpace(body.Code))
            return "code is required.";
        var code = NormalizeCode(body.Code);
        if (code.Length is < 1 or > 40)
            return "code must be 1–40 characters.";
        if (!code.All(c => char.IsLetterOrDigit(c) || c is '-' or '_'))
            return "code may only contain letters, digits, hyphen, and underscore.";
        return null;
    }

    static string NormalizeCode(string? code) =>
        (code ?? string.Empty).Trim().ToUpperInvariant();

    static string[] ParseStringArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json) || json.Trim() is "[]" or "null")
            return [];
        try
        {
            return JsonSerializer.Deserialize<string[]>(json, JsonOpts)?
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim())
                .ToArray() ?? [];
        }
        catch
        {
            return [];
        }
    }

    static int[] ParseIntArray(string? json)
    {
        if (string.IsNullOrWhiteSpace(json) || json.Trim() is "[]" or "null")
            return [];
        try
        {
            return JsonSerializer.Deserialize<int[]>(json, JsonOpts)?
                .Where(id => id > 0)
                .ToArray() ?? [];
        }
        catch
        {
            return [];
        }
    }

    static object Map(PosConfigType row)
    {
        var isEntertainment = string.Equals(row.Kind, "entertainment", StringComparison.OrdinalIgnoreCase);
        return new
        {
            id = row.Id,
            companyId = row.CompanyId,
            kind = row.Kind,
            name = row.Name,
            code = row.Code,
            sequence = row.Sequence,
            active = row.Active,
            includeAll = isEntertainment && row.IncludeAll,
            exceptionGroups = isEntertainment ? ParseStringArray(row.ExceptionGroupsJson) : Array.Empty<string>(),
            exceptionProductIds = isEntertainment ? ParseIntArray(row.ExceptionProductIdsJson) : Array.Empty<int>(),
            createdAt = row.CreatedAt,
            updatedAt = row.UpdatedAt,
        };
    }

    async Task EnsureDefaultsAsync(int companyId, CancellationToken cancellationToken)
    {
        var existing = await db.PosConfigTypes
            .Where(r => r.CompanyId == companyId)
            .Select(r => new { r.Kind, Code = r.Code.ToLower() })
            .ToListAsync(cancellationToken);
        var have = existing
            .GroupBy(x => x.Kind)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Code).ToHashSet());

        var now = DateTime.UtcNow;
        var toAdd = new List<PosConfigType>();

        void Seed(string kind, (string Code, string Name, int Seq)[] rows)
        {
            have.TryGetValue(kind, out var codes);
            codes ??= new HashSet<string>();
            // Only seed a kind when the company has no rows of that kind yet.
            if (codes.Count > 0) return;
            foreach (var (code, name, seq) in rows)
            {
                toAdd.Add(new PosConfigType
                {
                    CompanyId = companyId,
                    Kind = kind,
                    Code = code,
                    Name = name,
                    Sequence = seq,
                    Active = true,
                    IncludeAll = false,
                    ExceptionGroupsJson = "[]",
                    ExceptionProductIdsJson = "[]",
                    CreatedAt = now,
                    UpdatedAt = now,
                });
            }
        }

        Seed("payment",
        [
            ("CASH", "Cash", 10),
            ("CARD-EMV", "EMV Chip", 20),
            ("TAP", "Tap to Pay", 30),
            ("QR", "QR Pay", 40),
            ("GIFT-CARD", "Gift Card", 50),
        ]);
        Seed("entertainment",
        [
            ("STAFF", "Staff Meal", 10),
            ("COMP", "Complimentary", 20),
            ("PROMO", "Promotional", 30),
            ("MANAGER", "Manager Comp", 40),
        ]);
        Seed("discount",
        [
            ("PERCENT", "Percentage Discount", 10),
            ("AMOUNT", "Fixed Amount", 20),
            ("VIP", "VIP Discount", 30),
            ("SENIOR", "Senior Citizen", 40),
        ]);

        if (toAdd.Count == 0) return;
        db.PosConfigTypes.AddRange(toAdd);
        await db.SaveChangesAsync(cancellationToken);
    }
}
