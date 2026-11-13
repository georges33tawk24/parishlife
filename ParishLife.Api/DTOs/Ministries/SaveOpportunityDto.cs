// Purpose: requests a draft volunteer opportunity for a ministry.
// Main members: OperationId, Title/TitleAr, Position, Requirements, Location, StartsAt, EndsAt, Capacity and SelfSignup.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SaveOpportunityDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [StringLength(300)]
    public string? TitleAr { get; set; } = null;

    [Required]
    [StringLength(200)]
    public string Position { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Requirements { get; set; } = null;

    [StringLength(300)]
    public string? Location { get; set; } = null;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset EndsAt { get; set; }

    [Range(1, 500)]
    public int Capacity { get; set; }

    public bool SelfSignup { get; set; }
}
