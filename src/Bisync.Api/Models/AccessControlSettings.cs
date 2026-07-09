namespace Bisync.Api.Models;

public class AccessControlSettings
{
    public int Id { get; set; } = 1;
    /// <summary>JSON array of { id, label } for AC 1–AC 8.</summary>
    public string TypesJson { get; set; } = "[]";
    /// <summary>JSON object: taskKey -> { ac1: bool, ac2: bool, ... }.</summary>
    public string MatrixJson { get; set; } = "{}";
}
