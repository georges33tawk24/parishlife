// Purpose: schedules a dated maintenance block on one room or space; the block holds the room like a confirmed reservation.
// Main members: OperationId, ResourceId, StartsAt, EndsAt, Reason, ReasonAr and InCharge.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class MaintenanceDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid ResourceId { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? ReasonAr { get; set; } = null;

    [StringLength(200)]
    public string? InCharge { get; set; } = null;
}
