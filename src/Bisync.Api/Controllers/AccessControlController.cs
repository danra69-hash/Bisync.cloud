using System.Text.Json;
using Bisync.Api.Data;
using Bisync.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bisync.Api.Controllers;

[ApiController]
[Route("api/access-control")]
public class AccessControlController(BisyncDbContext db) : ControllerBase
{
    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    static readonly string[] DefaultTypeIds =
    [
        "ac1", "ac2", "ac3", "ac4", "ac5", "ac6", "ac7", "ac8",
    ];

    [HttpGet]
    public async Task<ActionResult<object>> Get()
    {
        var settings = await EnsureSettingsAsync();
        return Ok(new
        {
            typesJson = settings.TypesJson,
            matrixJson = settings.MatrixJson,
        });
    }

    [HttpPut]
    public async Task<ActionResult<object>> Update([FromBody] AccessControlUpdateRequest request)
    {
        var settings = await EnsureSettingsAsync();
        settings.TypesJson = NormalizeTypesJson(request.TypesJson);
        settings.MatrixJson = string.IsNullOrWhiteSpace(request.MatrixJson) ? "{}" : request.MatrixJson.Trim();
        await db.SaveChangesAsync();
        return Ok(new
        {
            typesJson = settings.TypesJson,
            matrixJson = settings.MatrixJson,
        });
    }

    async Task<AccessControlSettings> EnsureSettingsAsync()
    {
        var settings = await db.AccessControlSettings.FirstOrDefaultAsync();
        if (settings is not null) return settings;

        settings = new AccessControlSettings
        {
            Id = 1,
            TypesJson = JsonSerializer.Serialize(
                DefaultTypeIds.Select((id, index) => new { id, label = $"AC {index + 1}" }),
                JsonOptions),
            MatrixJson = "{}",
        };
        db.AccessControlSettings.Add(settings);
        await db.SaveChangesAsync();
        return settings;
    }

    static string NormalizeTypesJson(string? json)
    {
        try
        {
            var parsed = JsonSerializer.Deserialize<List<AccessControlTypeDto>>(json ?? "[]", JsonOptions) ?? [];
            if (parsed.Count != 8)
                return JsonSerializer.Serialize(
                    DefaultTypeIds.Select((id, index) => new AccessControlTypeDto
                    {
                        Id = id,
                        Label = parsed.ElementAtOrDefault(index)?.Label?.Trim() is { Length: > 0 } label
                            ? label
                            : $"AC {index + 1}",
                    }),
                    JsonOptions);

            return JsonSerializer.Serialize(
                parsed.Select((type, index) => new AccessControlTypeDto
                {
                    Id = string.IsNullOrWhiteSpace(type.Id) ? DefaultTypeIds[index] : type.Id.Trim(),
                    Label = string.IsNullOrWhiteSpace(type.Label) ? $"AC {index + 1}" : type.Label.Trim(),
                }),
                JsonOptions);
        }
        catch
        {
            return JsonSerializer.Serialize(
                DefaultTypeIds.Select((id, index) => new AccessControlTypeDto { Id = id, Label = $"AC {index + 1}" }),
                JsonOptions);
        }
    }
}

public class AccessControlUpdateRequest
{
    public string TypesJson { get; set; } = "[]";
    public string MatrixJson { get; set; } = "{}";
}

public class AccessControlTypeDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}
