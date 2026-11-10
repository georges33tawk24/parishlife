// Purpose: shows a recorded consent and whether it is still given.
// Main members: Id, PersonId, Kind, Purpose, PolicyVersion, Fields, Source, GivenBy, GivenAt, Status, WithdrawnAt and WithdrawalReason.

namespace ParishLife.Api.DTOs.People;

public class ConsentDto
{
    public string Id { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string PolicyVersion { get; set; } = string.Empty;

    public string[] Fields { get; set; } = Array.Empty<string>();

    public string Source { get; set; } = string.Empty;

    public string GivenBy { get; set; } = string.Empty;

    public DateTimeOffset GivenAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset? WithdrawnAt { get; set; }

    public string? WithdrawalReason { get; set; }
}
