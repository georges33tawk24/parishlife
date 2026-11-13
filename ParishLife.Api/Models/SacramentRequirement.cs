// Purpose: one preparation requirement a priest listed for a sacrament in this parish; the parish supplies every label, nothing is built in.
// Main members: Key (short stable identifier), Label and its Arabic twin LabelAr.

namespace ParishLife.Api.Models;

public class SacramentRequirement
{
    public string Key { get; set; } = string.Empty;

    public string? Label { get; set; } = null;

    public string? LabelAr { get; set; } = null;
}
