// Purpose: represents event registration business state and rules.
// Main members: Id, ParishId, EventId, PersonId, FormVersionId, Status, Transport, arrangements, the latest tracked notification-work batch,
// HouseholdId (household registration), the applied discount snapshot and the pickup-code hash (never the plain code).

namespace ParishLife.Api.Models;

public class EventRegistration
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    // Office or Self; the requester stays in CreatedBy and the participant in PersonId.
    public string Origin { get; set; } = "Office";

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

    // Null means legacy/untracked; an empty list means the latest tracked transition required no account notice.
    public List<string>? NotificationWorkIds { get; set; } = null;

    // Set when the office registered this participant as part of a household.
    public string? HouseholdId { get; set; } = null;

    // The discount applied by the office, copied from the policy when applied; later policy edits do not change it.
    public string? DiscountKey { get; set; } = null;

    public string? DiscountName { get; set; } = null;

    public string? DiscountNameAr { get; set; } = null;

    public decimal DiscountAmount { get; set; }

    // Salted SHA-256 of the pickup code; the plain code is shown once when issued and never stored.
    public string? PickupCodeHash { get; set; } = null;

    public string? PickupCodeSalt { get; set; } = null;

    public DateTimeOffset? PickupCodeIssuedAt { get; set; } = null;
}
