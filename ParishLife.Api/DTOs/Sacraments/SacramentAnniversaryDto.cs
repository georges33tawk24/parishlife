// Purpose: one upcoming anniversary of a registered sacrament, for authorized clergy/office or the person themselves.
// Main members: RecordId, Sacrament, PersonId, PersonName, CelebratedOn, NextOn and Years.

namespace ParishLife.Api.DTOs.Sacraments;

public class SacramentAnniversaryDto
{
    public string RecordId { get; set; } = string.Empty;

    public string Sacrament { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string PersonName { get; set; } = string.Empty;

    public DateOnly CelebratedOn { get; set; }

    public DateOnly NextOn { get; set; }

    public int Years { get; set; }
}
