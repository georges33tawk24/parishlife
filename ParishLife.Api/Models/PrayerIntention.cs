// Purpose: represents a submitted prayer intention, private to clergy until published within the submitter's chosen limit.
// Main members: Id, ParishId, ApplicantAccountId, DisplayName, Text, RequestedVisibility, Status, decision facts and dates.

namespace ParishLife.Api.Models;

public class PrayerIntention
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string ApplicantAccountId { get; set; } = string.Empty;

    public string? DisplayName { get; set; } = null;

    public string Text { get; set; } = string.Empty;

    // ClergyPrivate, AnonymousPublic or IdentifiedPublic: the most the submitter allows.
    public string RequestedVisibility { get; set; } = "ClergyPrivate";

    // Received, PublishedAnonymous, PublishedIdentified, KeptPrivate or Declined.
    public string Status { get; set; } = "Received";

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public DateTimeOffset SubmittedAt { get; set; }
}
