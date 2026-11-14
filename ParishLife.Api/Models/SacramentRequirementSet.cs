// Purpose: the parish's own list of preparation requirements for one sacrament, saved by a priest; there is no default list.
// Main members: Sacrament, Items, BlockSchedulingUntilMet (the priest's choice whether a date waits for every item), SavedBy and SavedAt.

namespace ParishLife.Api.Models;

public class SacramentRequirementSet
{
    public string Sacrament { get; set; } = string.Empty;

    public SacramentRequirement[] Items { get; set; } = Array.Empty<SacramentRequirement>();

    public bool BlockSchedulingUntilMet { get; set; }

    public string SavedBy { get; set; } = string.Empty;

    public DateTimeOffset SavedAt { get; set; }
}
