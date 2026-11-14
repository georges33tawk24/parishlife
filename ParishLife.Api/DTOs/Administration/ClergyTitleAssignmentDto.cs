// Purpose: the clergy title currently assigned to one account (or none), as read by any signed-in account for display.
// Main members: AccountId, ClergyTitleId, Title, TitleAr, AssignedAt and AssignedBy.

namespace ParishLife.Api.DTOs.Administration;

public class ClergyTitleAssignmentDto
{
    public string AccountId { get; set; } = string.Empty;

    public string? ClergyTitleId { get; set; } = null;

    public string? Title { get; set; } = null;

    public string? TitleAr { get; set; } = null;

    public DateTimeOffset? AssignedAt { get; set; } = null;

    public string? AssignedBy { get; set; } = null;
}
