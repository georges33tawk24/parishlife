// Purpose: requests one certificate transition with the conditional source, reason and recipient-verification fields.
// Main members: OperationId, Version, Action, SourceRecordId, Reason, RecipientName, RecipientRelationship, VerificationMethod and VerificationEvidence.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class CertificateActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(link-source|prepare|submit|sign|accept|return|issue|release|withdraw|cancel)$")]
    public string Action { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? SourceRecordId { get; set; } = null;

    [StringLength(2000)]
    public string? Reason { get; set; } = null;

    [StringLength(200)]
    public string? RecipientName { get; set; } = null;

    [StringLength(100)]
    public string? RecipientRelationship { get; set; } = null;

    [RegularExpression("^(InPerson|VerifiedAccount|Representative)$")]
    public string? VerificationMethod { get; set; } = null;

    [StringLength(1000)]
    public string? VerificationEvidence { get; set; } = null;
}
