// Purpose: returns one participant registration; staff projections include evidence and collectors, own projections omit them.
// Main members: Id, EventId, PersonId, FormVersionId, Origin, effective Status, answers, evidence, collectors, money balance and presence.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Registrations;

public class EventRegistrationDto
{
    public string Id { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string FormVersionId { get; set; } = string.Empty;

    public string Origin { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public bool Transport { get; set; }

    public Dictionary<string, string> Answers { get; set; } = new();

    public string? ConsentEvidence { get; set; } = null;

    public string? GuardianAuthorityEvidence { get; set; } = null;

    public AuthorizedCollector[]? Collectors { get; set; } = null;

    public bool IndependentDeparture { get; set; }

    public decimal Fee { get; set; }

    public string Currency { get; set; } = string.Empty;

    public decimal Received { get; set; }

    public decimal Refunded { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string? CreatedBy { get; set; } = null;

    public DateTimeOffset? OfferUntil { get; set; } = null;

    public string Presence { get; set; } = string.Empty;

    public DateTimeOffset? LastPresenceAt { get; set; } = null;
}
