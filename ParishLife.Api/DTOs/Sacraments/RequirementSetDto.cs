// Purpose: returns the parish's preparation requirement list for one sacrament with the version a later save must send.
// Main members: Sacrament, Version, Items, BlockSchedulingUntilMet, SavedBy and SavedAt.

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
}
