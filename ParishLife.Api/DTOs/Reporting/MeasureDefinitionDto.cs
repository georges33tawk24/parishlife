// Purpose: one measure on the bishop overview with its exact definition and whether it covers the requested period or the moment of generation.
// Main members: Key, Definition, Basis.

namespace ParishLife.Api.DTOs.Reporting;

public class MeasureDefinitionDto
{
    public string Key { get; set; } = string.Empty;

    public string Definition { get; set; } = string.Empty;

    public string Basis { get; set; } = string.Empty;
}
