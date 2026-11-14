// Purpose: creates or edits a broadcast automation that drafts one broadcast from an approved template at each due time, up to MaxRuns times.
// Main members: OperationId, Version, Name, NameAr, TemplateId, Audience, MinistryId, Recurrence, FirstRunAt (UTC) and MaxRuns.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class SaveBroadcastAutomationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(200)]
    public string? NameAr { get; set; } = null;

    [NotEmptyGuid]
    public Guid TemplateId { get; set; }

    [Required, RegularExpression("^(Members|Ministry)$")]
    public string Audience { get; set; } = "Members";

    [NotEmptyGuid]
    public Guid? MinistryId { get; set; } = null;

    [Required, RegularExpression("^(Weekly|Monthly)$")]
    public string Recurrence { get; set; } = "Weekly";

    public DateTimeOffset FirstRunAt { get; set; }

    [Range(1, 52)]
    public int MaxRuns { get; set; } = 1;
}
