using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/rev-mgmt/config")]
public class RevMgmtConfigController(BisyncDbContext db) : ControllerBase
{
    public const string ComponentHierarchyKey = "componentHierarchy";
    public const string StorageAssignmentKey = "storageAssignment";
    public const string ComponentCatalogKey = "componentCatalog";

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [HttpGet("{companyId:int}/{configKey}")]
    public async Task<ActionResult<object>> Get(int companyId, string configKey)
    {
        if (!IsSupportedKey(configKey))
            return BadRequest(new { message = "Unsupported config key." });

        var row = await db.RevMgmtCompanyConfigs.AsNoTracking()
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.ConfigKey == configKey);

        if (row is null)
        {
            return Ok(new
            {
                companyId,
                configKey,
                state = ParseState(configKey, null),
                seeded = true,
            });
        }

        return Ok(new
        {
            companyId,
            configKey,
            state = ParseState(configKey, row.StateJson),
            updatedAt = row.UpdatedAt,
            seeded = false,
        });
    }

    [HttpPut("{companyId:int}/{configKey}")]
    public async Task<ActionResult<object>> Put(int companyId, string configKey, [FromBody] RevMgmtConfigUpdateRequest request)
    {
        if (!IsSupportedKey(configKey))
            return BadRequest(new { message = "Unsupported config key." });

        var stateJson = string.IsNullOrWhiteSpace(request.StateJson)
            ? JsonSerializer.Serialize(ParseState(configKey, null), JsonOptions)
            : request.StateJson.Trim();

        var row = await db.RevMgmtCompanyConfigs
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.ConfigKey == configKey);

        if (row is null)
        {
            row = new RevMgmtCompanyConfig
            {
                CompanyId = companyId,
                ConfigKey = configKey,
                StateJson = stateJson,
                UpdatedAt = DateTime.UtcNow,
            };
            db.RevMgmtCompanyConfigs.Add(row);
        }
        else
        {
            row.StateJson = stateJson;
            row.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();

        return Ok(new
        {
            companyId,
            configKey,
            state = ParseState(configKey, row.StateJson),
            updatedAt = row.UpdatedAt,
        });
    }

    static bool IsSupportedKey(string configKey) =>
        configKey is ComponentHierarchyKey or StorageAssignmentKey or ComponentCatalogKey;

    static object ParseState(string configKey, string? json)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(json))
            {
                using var doc = JsonDocument.Parse(json);
                return JsonSerializer.Deserialize<object>(doc.RootElement.GetRawText(), JsonOptions) ?? new { };
            }
        }
        catch
        {
            // fall through to defaults
        }

        return configKey switch
        {
            ComponentHierarchyKey => RevMgmtDefaults.ComponentHierarchy(),
            StorageAssignmentKey => RevMgmtDefaults.StorageAssignment(),
            ComponentCatalogKey => RevMgmtDefaults.ComponentCatalog(),
            _ => new { },
        };
    }
}

public class RevMgmtConfigUpdateRequest
{
    public string StateJson { get; set; } = "{}";
}
