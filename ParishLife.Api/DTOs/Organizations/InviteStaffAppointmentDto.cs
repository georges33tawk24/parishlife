// Purpose: requests a bishop-authorized staff invitation with explicitly scoped duties and private fresh proofs.
// Main members: OperationId, ScopeVersion, AccountId, Role, Allows, Denies, StartsAt and related workflow state.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class InviteStaffAppointmentDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string ScopeVersion { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid AccountId { get; set; }

    [Required]
    [EnumDataType(typeof(StaffAppointmentRole))]
    public StaffAppointmentRole? Role { get; set; }

    [Required]
    [MaxLength(64)]
    public string[] Allows { get; set; } = Array.Empty<string>();

    [Required]
    [MaxLength(64)]
    public string[] Denies { get; set; } = Array.Empty<string>();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public DateTimeOffset AcceptBy { get; set; }

    public DateTimeOffset? ReviewDueAt { get; set; }

    public bool IsHead { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(12)]
    public string CurrentCode { get; set; } = string.Empty;
}
