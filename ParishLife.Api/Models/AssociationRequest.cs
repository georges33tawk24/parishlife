// Purpose: represents association request business state and rules.
// Main members: Id, ParishId, ArchdioceseId, RequestedBy, RequestedAt, Status, DecidedBy, and related workflow details.

namespace ParishLife.Api.Models;

public class AssociationRequest
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string RequestedBy { get; set; } = string.Empty;

    public DateTimeOffset RequestedAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;
}
