// Purpose: the archdiocese bishop's answer on an open parish ownership claim (owner decision, 23 November 2026): the church confirms or
// disputes the claim before a ParishLife operator may recover administration.
// Main members: OperationId, Version, Confirmed, Note.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class ConfirmOwnershipClaimDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    public bool? Confirmed { get; set; }

    [Required]
    [StringLength(1000)]
    public string Note { get; set; } = string.Empty;
}
