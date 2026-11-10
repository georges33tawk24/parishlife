// Purpose: appoints an independent concern reviewer for the bishop's archdiocese.
// Main members: OperationId, AccountId, Description, Categories, CanViewIdentity and EvidenceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Care;

public class AppointReviewerDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid AccountId { get; set; }

    [Required]
    [StringLength(500)]
    public string Description { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    [MaxLength(4)]
    public string[] Categories { get; set; } = Array.Empty<string>();

    public bool CanViewIdentity { get; set; }

    [Required]
    [StringLength(1000)]
    public string EvidenceReference { get; set; } = string.Empty;
}
