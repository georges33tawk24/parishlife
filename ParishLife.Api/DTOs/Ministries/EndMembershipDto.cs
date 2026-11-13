// Purpose: requests a priest's explicit end of one person's current ministry membership (roster removal) without a departure application.
// Main members: OperationId, JoinedAt (pins the exact membership interval being ended) and the required Reason, which is stored protected.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class EndMembershipDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    public DateTimeOffset JoinedAt { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
