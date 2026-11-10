// Purpose: one recorded consent (directory, photo, communications, event or representation) with its purpose/version, source and giver;
// withdrawal is recorded, never erased.
// Main members: Id, ParishId, PersonId, Kind, Purpose, PolicyVersion, Fields, Source, GivenBy, RecordedBy, GivenAt, Status, WithdrawnAt and WithdrawalReason.

namespace ParishLife.Api.Models;

public class PersonConsent
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string PolicyVersion { get; set; } = string.Empty;

    // Directory consent names the exact fields it discloses.
    public string[] Fields { get; set; } = Array.Empty<string>();

    // Digital (given by the signed-in person) or PaperReceived (recorded by the office from a paper form).
    public string Source { get; set; } = string.Empty;

    public string GivenBy { get; set; } = string.Empty;

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset GivenAt { get; set; }

    public string Status { get; set; } = "Given";

    public DateTimeOffset? WithdrawnAt { get; set; }

    public string? WithdrawalReason { get; set; }
}
