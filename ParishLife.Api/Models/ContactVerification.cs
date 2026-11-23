// Purpose: stores one staged contact-ownership challenge (confirm the current email or prove a replacement email).
// Main members: Id, AccountId, Purpose, TargetEmail/NormalizedTarget, CodeHash (never the code), Attempts, Status, Delivery,
// SecurityStampAtStart, CreatedAt, ExpiresAt, CompletedAt; WindowStartedAt and SentInWindow count the codes sent for this purpose in
// the current 24 hours (the daily cap).

namespace ParishLife.Api.Models;

public class ContactVerification
{
    public string Id { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Purpose { get; set; } = "ConfirmEmail";

    public string TargetEmail { get; set; } = string.Empty;

    public string NormalizedTarget { get; set; } = string.Empty;

    public string CodeHash { get; set; } = string.Empty;

    public int Attempts { get; set; }

    public string Status { get; set; } = "Pending";

    public string Delivery { get; set; } = "NotConfigured";

    public string SecurityStampAtStart { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }

    public DateTimeOffset? WindowStartedAt { get; set; }

    public int SentInWindow { get; set; }
}
