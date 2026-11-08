// Purpose: represents registration field business state and rules.
// Main members: Key, Label, Type, Required, Options, VisibleWhenField, VisibleWhenValue.

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
}
