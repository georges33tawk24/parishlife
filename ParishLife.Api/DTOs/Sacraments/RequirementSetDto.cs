// Purpose: returns a preparation requirement list for one sacrament with the version a later save must send.
// Main members: Sacrament, Version, Items, BlockSchedulingUntilMet, SavedBy, SavedAt and Source (Archdiocese: set by the archdiocese for all
// its parishes; Parish: the parish's own list, used while the archdiocese has none for that sacrament).

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Sacraments;

public class RequirementSetDto
{
    public string Sacrament { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public SacramentRequirement[] Items { get; set; } = Array.Empty<SacramentRequirement>();

    public bool BlockSchedulingUntilMet { get; set; }

    public string SavedBy { get; set; } = string.Empty;

    public DateTimeOffset SavedAt { get; set; }

    public string Source { get; set; } = "Parish";
}
