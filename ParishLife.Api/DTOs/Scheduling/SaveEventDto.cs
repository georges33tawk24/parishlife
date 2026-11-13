// Purpose: represents save event input/output data.
// Main members: OperationId, Version, Title, Kind, StartsAt, EndsAt, TimeZone, and related workflow details; optional Arabic twins TitleAr and DescriptionAr.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveEventDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; }

    [Required]
    [StringLength(500)]
    public string Title { get; set; } = string.Empty;

    [StringLength(500)]
    public string? TitleAr { get; set; } = null;

    [Required]
    [StringLength(500)]
    public string Kind { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    [Required]
    [StringLength(500)]
    public string TimeZone { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Visibility { get; set; } = string.Empty;
    [NotEmptyGuid]
    public Guid? MinistryId { get; set; }

    [StringLength(10000)]
    public string? Description { get; set; }

    [StringLength(10000)]
    public string? DescriptionAr { get; set; } = null;

    public Guid[]? ClergyAccountIds { get; set; } = null;

    [StringLength(500)]
    public string? SourceType { get; set; } = null;
    [NotEmptyGuid]
    public Guid? SourceId { get; set; } = null;
}
