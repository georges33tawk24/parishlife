// Purpose: stores an explicitly registered archdiocese and its representative-verification state.
// Main members: Id, Name, Locality, OwnerAccountId, BillingRepresentativeAccountId, CreatedAt, Verified, VerificationReference and
// BillingRepresentative() (the named representative, else the registering account).

namespace ParishLife.Api.Models;

public class Archdiocese
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string OwnerAccountId { get; set; } = string.Empty;

    // The account the archdiocese named to act for it in billing (owner decision, 23 November 2026); null until named, when the registering
    // account (OwnerAccountId) still acts.
    public string? BillingRepresentativeAccountId { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public bool Verified { get; set; } = false;

    public string? VerificationReference { get; set; } = null;

    public string BillingRepresentative() => BillingRepresentativeAccountId ?? OwnerAccountId;
}
