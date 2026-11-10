// Purpose: carries one running-order item in plan saves and responses, with computed start/end in responses.
// Main members: Key, Title, Minutes, FixedStart, ResponsibleRole, Required, AssignedAccountId, Instructions, InstructionAudience, MusicVersionId, StartsAt and EndsAt.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class PlanItemDto
{
    [Required]
    [RegularExpression("^[a-z0-9][a-z0-9-]{0,39}$")]
    public string Key { get; set; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [Range(0, 1440)]
    public int Minutes { get; set; }

    public DateTimeOffset? FixedStart { get; set; } = null;

    [StringLength(100)]
    public string? ResponsibleRole { get; set; } = null;

    public bool Required { get; set; }

    [NotEmptyGuid]
    public Guid? AssignedAccountId { get; set; } = null;

    [StringLength(2000)]
    public string? Instructions { get; set; } = null;

    [Required]
    [RegularExpression("^(Clergy|Team|Everyone)$")]
    public string InstructionAudience { get; set; } = "Clergy";

    [NotEmptyGuid]
    public Guid? MusicVersionId { get; set; } = null;

    // Computed in responses.
    public DateTimeOffset? StartsAt { get; set; } = null;

    public DateTimeOffset? EndsAt { get; set; } = null;
}
