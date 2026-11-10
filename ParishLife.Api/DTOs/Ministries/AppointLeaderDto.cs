// Purpose: requests an evidenced ministry leadership appointment or an immediate, explicit handover.
// Main members: OperationId, MinistryVersion, AccountId, Role, dates, EvidenceReference and outgoing identity/version.

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
    [RegularExpression("^(Leader|Assistant)$")]
    [StringLength(20)]
    public string Role { get; set; } = string.Empty;

    [Required, MaxLength(7)]
    public string[] Duties { get; set; } = Array.Empty<string>();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    [Required]
    [StringLength(1000)]
    public string EvidenceReference { get; set; } = string.Empty;
    [NotEmptyGuid]
    public Guid? ReplaceAccountId { get; set; } = null;

    [StringLength(1024)]
    public string? ReplaceVersion { get; set; }
}
