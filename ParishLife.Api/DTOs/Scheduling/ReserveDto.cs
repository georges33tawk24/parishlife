// Purpose: represents reserve input/output data.
// Main members: OperationId, ResourceId, EventId, StartsAt, EndsAt, AdditionalResourceIds, CustomerId, and related workflow details.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class ReserveDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [NotEmptyGuid]
    public Guid ResourceId { get; set; }
    [NotEmptyGuid]
    public Guid EventId { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    [MaxLength(24)]
    public Guid[]? AdditionalResourceIds { get; set; } = null;
    [NotEmptyGuid]
    public Guid? CustomerId { get; set; } = null;

    [StringLength(10000)]
    public string? TermsSnapshot { get; set; } = null;
}
