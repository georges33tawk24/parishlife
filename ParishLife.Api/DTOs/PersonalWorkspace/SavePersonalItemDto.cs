// Purpose: validates bounded personal draft/save input; ownership and audience are derived from the personal session.
// Main members: OperationId, Version, Kind, SaveAsDraft, Title, Body, Category, Tags, Priority, PriorityReason, DueAt,
// Pinned, ReminderAt (a private date shown in My notes; nothing is sent) and the linked meeting ids (all three or none).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class SavePersonalItemDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [StringLength(1024)]
    public string? Version { get; set; }
    [Required, RegularExpression("^(Note|Task)$")]
    public string Kind { get; set; } = "Note";
    public bool SaveAsDraft { get; set; }
    [StringLength(500)]
    public string? Title { get; set; }
    [StringLength(20000)]
    public string Body { get; set; } = string.Empty;
    [StringLength(100)]
    public string? Category { get; set; }
    [MaxLength(20)]
    public string[] Tags { get; set; } = Array.Empty<string>();
    [RegularExpression("^(Routine|TimeSensitive|High)$")]
    public string? Priority { get; set; }
    [StringLength(2000)]
    public string? PriorityReason { get; set; }
    public DateTimeOffset? DueAt { get; set; }
    public bool Pinned { get; set; }
    public DateTimeOffset? ReminderAt { get; set; }
    public Guid? MeetingParishId { get; set; }
    public Guid? MeetingMinistryId { get; set; }
    public Guid? MeetingId { get; set; }
}
