// Purpose: returns a confidential departure reason only to its owner or an authorized selected priest.
// Main members: ApplicationId, Reason, RecordedAt.

namespace ParishLife.Api.DTOs.Ministries;

public class PrivateDepartureDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }
}
