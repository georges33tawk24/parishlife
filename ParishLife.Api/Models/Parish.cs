// Purpose: stores parish identity and verification, factual jurisdiction, and its separate optional commercial association.
// Main functions: Verify.

using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Models;

public class Parish
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string Contact { get; set; } = string.Empty;

    public string? DeclaredArchdiocese { get; set; }

    public ParishStatus Status { get; set; }

    public string OwnerAccountId { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? RegisteredArchdioceseId { get; set; } = null;

    public string? VerificationReference { get; set; } = null;

    public string? RegisteredAssociationId { get; set; } = null;

    public string? JurisdictionArchdioceseId { get; set; }

    public string? JurisdictionProposalId { get; set; }

    public Parish Verify(string reference) => Status == ParishStatus.PendingVerification ? new Parish
    {
        Id = this.Id,
        Name = this.Name,
        Locality = this.Locality,
        Contact = this.Contact,
        DeclaredArchdiocese = this.DeclaredArchdiocese,
        Status = ParishStatus.Verified,
        OwnerAccountId = this.OwnerAccountId,
        CreatedAt = this.CreatedAt,
        RegisteredArchdioceseId = this.RegisteredArchdioceseId,
        VerificationReference = Guard.Text(reference, "Verification reference", 500),
        RegisteredAssociationId = this.RegisteredAssociationId,
        JurisdictionArchdioceseId = this.JurisdictionArchdioceseId,
        JurisdictionProposalId = this.JurisdictionProposalId
    }

    : throw new DomainException("invalid_state", "Only a pending parish can be verified.", FailureKind.Conflict);
}
