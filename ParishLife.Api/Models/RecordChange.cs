// Purpose: represents record change business state and rules.
// Main functions: Remove.

namespace ParishLife.Api.Models;

public class RecordChange
{
    public string Id { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public object? Value { get; set; }

    public string? ExpectedVersion { get; set; }

    public string Action { get; set; } = "create";

    public static RecordChange Create<T>(string id, string type, T value) => new RecordChange
    {
        Id = id,
        Type = type,
        Value = value,
        ExpectedVersion = null
    };
    public static RecordChange Replace<T>(string id, string type, T value, string version) => new RecordChange
    {
        Id = id,
        Type = type,
        Value = value,
        ExpectedVersion = version,
        Action = "replace"
    };
    public static RecordChange Remove(string id, string version) => new RecordChange
    {
        Id = id,
        Type = "",
        Value = null,
        ExpectedVersion = version,
        Action = "delete"
    };
}
