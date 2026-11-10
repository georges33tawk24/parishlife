// Purpose: shows an external renter to facilities/finance staff.
// Main members: Id, Name, Organization, ResponsibleContact, VerificationReference and CreatedAt.

namespace ParishLife.Api.DTOs.Scheduling;

public class RenterDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Organization { get; set; }

    public string ResponsibleContact { get; set; } = string.Empty;

    public string? VerificationReference { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
