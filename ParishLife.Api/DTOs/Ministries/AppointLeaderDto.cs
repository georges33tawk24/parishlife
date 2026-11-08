// Purpose: represents appoint leader input/output data.
// Main members: OperationId, MinistryVersion, AccountId, Role, StartsAt, EndsAt, EvidenceReference, and related workflow details.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class AppointLeaderDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string MinistryVersion { get; set; } = string.Empty;
    [NotEmptyGuid]
    public Guid AccountId { get; set; }

    [Required]
    [StringLength(500)]
    public string Role { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;
    [NotEmptyGuid]
    public Guid? ReplaceAccountId { get; set; } = null;
}
