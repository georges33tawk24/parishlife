// Purpose: records a bishop-authorized suspension, resumption, revocation or review with fresh proofs.
// Main members: OperationId, Version, Action, Reason, ReviewDueAt, CurrentPassword, CurrentCode.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class ActStaffAppointmentDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [EnumDataType(typeof(StaffAppointmentAction))]
    public StaffAppointmentAction? Action { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    public DateTimeOffset? ReviewDueAt { get; set; }

    [Required]
    [StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(12)]
    public string CurrentCode { get; set; } = string.Empty;
}
