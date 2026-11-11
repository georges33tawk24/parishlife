// Purpose: lets the jurisdiction bishop record whether an approved electronic-signature arrangement exists for the archdiocese's parishes.
// Main members: OperationId, Approved (required, never defaulted), ApprovalReference (required when approving) and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Documents;

public class SignatureArrangementDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    public bool? Approved { get; set; } = null;

    [StringLength(300)]
    public string? ApprovalReference { get; set; } = null;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
