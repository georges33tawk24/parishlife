// Purpose: represents event registration business state and rules.
// Main members: Id, ParishId, EventId, PersonId, FormVersionId, Status, Transport, and related workflow details.

namespace ParishLife.Api.Models;

public class EventRegistration
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string FormVersionId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public bool Transport { get; set; }

    public Dictionary<string, string> Answers { get; set; } = new();

    public string? ConsentEvidence { get; set; }

    public string? GuardianAuthorityEvidence { get; set; }

    public AuthorizedCollector[] Collectors { get; set; } = Array.Empty<AuthorizedCollector>();

    public bool IndependentDeparture { get; set; }

    public decimal Fee { get; set; }

    public string Currency { get; set; } = string.Empty;

    public int Precision { get; set; }

    public decimal Received { get; set; }

    public decimal Refunded { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset? OfferUntil { get; set; } = null;

    public string Presence { get; set; } = "NotArrived";

    public DateTimeOffset? LastPresenceAt { get; set; } = null;
}
