// Purpose: represents formation completion business state and rules.
// Main members: Id, MinistryId, ProgramId, PersonId, ReviewedBy, At.

namespace ParishLife.Api.Models;

public class FormationCompletion
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string ProgramId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string ReviewedBy { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
