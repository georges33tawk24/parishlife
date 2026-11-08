// Purpose: returns the explicit authorized AssociationRequest response fields without binding the persistence model.
// Main members: response properties; From maps the allowed fields and copies exposed collections.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Organizations;

public class AssociationDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string RequestedBy { get; set; } = string.Empty;

    public DateTimeOffset RequestedAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public static AssociationDto From(AssociationRequest value)
    {
        return new AssociationDto
        {
            Id = value.Id,
            ParishId = value.ParishId,
            ArchdioceseId = value.ArchdioceseId,
            RequestedBy = value.RequestedBy,
            RequestedAt = value.RequestedAt,
            Status = value.Status,
            DecidedBy = value.DecidedBy,
            DecidedAt = value.DecidedAt
        };
    }
}
