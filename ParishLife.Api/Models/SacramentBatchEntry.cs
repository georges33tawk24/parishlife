// Purpose: one person's outcome inside a group sacrament request.
// Main members: PersonId, RecordId (the case opened, or null), ErrorCode and Message (why no case was opened).

namespace ParishLife.Api.Models;

public class SacramentBatchEntry
{
    public string PersonId { get; set; } = string.Empty;

    public string? RecordId { get; set; } = null;

    public string? ErrorCode { get; set; } = null;

    public string? Message { get; set; } = null;
}
