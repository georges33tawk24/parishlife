// Purpose: stores an explicitly registered archdiocese and its representative-verification state.
// Main members: Id, Name, Locality, OwnerAccountId, CreatedAt, Verified, VerificationReference.

namespace ParishLife.Api.Models;

public class Archdiocese
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string OwnerAccountId { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public bool Verified { get; set; } = false;

    public string? VerificationReference { get; set; } = null;
}
