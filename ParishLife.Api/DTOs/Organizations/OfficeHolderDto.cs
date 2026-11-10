// Purpose: one current office holder with their office duties and open work.
// Main members: AccountId, Duties, EndsAt, OpenRequests and OpenIncidents.

namespace ParishLife.Api.DTOs.Organizations;

public class OfficeHolderDto
{
    public string AccountId { get; set; } = string.Empty;

    public string[] Duties { get; set; } = Array.Empty<string>();

    public DateTimeOffset? EndsAt { get; set; }

    public int OpenRequests { get; set; }

    public int OpenIncidents { get; set; }
}
