// Purpose: requests withdrawal of a formation enrollment or a priest's reviewed reopening of a withdrawn one.
// Main members: OperationId, Version, Action (withdraw or reopen) and the required Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class FormationEnrollmentActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(withdraw|reopen)$")]
    public string Action { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
