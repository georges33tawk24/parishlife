// Purpose: requests bounded local-wall-time recurrence of manual draft events without a nested command identifier.
// Main members: OperationId, Title, Kind, StartsAt, EndsAt, TimeZone, Visibility and related workflow values.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class CreateSeriesDto
{

    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Kind { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    [Required]
    [StringLength(100)]
    public string TimeZone { get; set; } = string.Empty;

    [Required]
    [StringLength(30)]
    public string Visibility { get; set; } = string.Empty;

    [StringLength(10000)]
    public string? Description { get; set; }

    [Range(1, 52)]
    public int Count { get; set; }

    [Range(1, 366)]
    public int IntervalDays { get; set; }
}
