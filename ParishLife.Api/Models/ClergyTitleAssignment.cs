// Purpose: the clergy title a platform operator assigned to one account; it grants no authority and is separate from appointments and office.
// Main members: AccountId, ClergyTitleId, AssignedAt and AssignedBy.

namespace ParishLife.Api.Models;

public class ClergyTitleAssignment
{
    public string AccountId { get; set; } = string.Empty;

    public string? ClergyTitleId { get; set; } = null;

    public DateTimeOffset AssignedAt { get; set; }

    public string AssignedBy { get; set; } = string.Empty;
}
