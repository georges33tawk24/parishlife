// Purpose: represents reserve input/output data.
// Main members: OperationId, ResourceId, EventId, StartsAt, EndsAt, AdditionalResourceIds, CustomerId, TermsSnapshot and the optional Purpose, PurposeAr, ExpectedAttendance, ContactPhone and Notes.

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

    [StringLength(500)]
    public string? Purpose { get; set; } = null;

    [StringLength(500)]
    public string? PurposeAr { get; set; } = null;

    [Range(0, 100000)]
    public int? ExpectedAttendance { get; set; } = null;

    [StringLength(50)]
    public string? ContactPhone { get; set; } = null;

    [StringLength(2000)]
    public string? Notes { get; set; } = null;
}
