// Purpose: one versioned form field shared by event registration forms and custom workflow forms.
// Main members: Key, Label, Type, Required, Options, VisibleWhenField/VisibleWhenValue (conditional show) and
// RequiredWhenField/RequiredWhenValue (conditional require). New optional members are omitted from JSON when null so
// stored forms and request fingerprints written before they existed stay byte-identical.

using System.Text.Json.Serialization;

namespace ParishLife.Api.Models;

public class RegistrationField
{
    public string Key { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public bool Required { get; set; }

    public string[] Options { get; set; } = Array.Empty<string>();

    public string? VisibleWhenField { get; set; } = null;

    public string? VisibleWhenValue { get; set; } = null;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? RequiredWhenField { get; set; } = null;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? RequiredWhenValue { get; set; } = null;
}
