// Purpose: the WhatsApp number an account chose to receive notices on, proven with a one-use code sent to that number.
// Main members: Phone (E.164, e.g. +9613123456), Status (Pending or Verified), CodeHash (SHA-256 of the pending code; never the code),
// ExpiresAt, Attempts, SentAt and VerifiedAt. Stored in the account partition.

namespace ParishLife.Api.Models;

public class WhatsAppContact
{
    public string Phone { get; set; } = string.Empty;

    public string Status { get; set; } = "Pending";

    public string? CodeHash { get; set; } = null;

    public DateTimeOffset? ExpiresAt { get; set; } = null;

    public int Attempts { get; set; }

    public DateTimeOffset? SentAt { get; set; } = null;

    public DateTimeOffset? VerifiedAt { get; set; } = null;
}
