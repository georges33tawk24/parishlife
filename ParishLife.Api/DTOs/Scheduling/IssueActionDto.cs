// Purpose: triages, assigns, starts, resolves or dismisses a facility issue.
// Main members: OperationId, Version, Action, AssignedTo, Note, Evidence and CostNote.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class IssueActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(triage|start-repair|resolve|dismiss)$")]
    public string Action { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? AssignedTo { get; set; } = null;

    [StringLength(2000)]
    public string? Note { get; set; } = null;

    [StringLength(1000)]
    public string? Evidence { get; set; } = null;

    [StringLength(500)]
    public string? CostNote { get; set; } = null;
}
