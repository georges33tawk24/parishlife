// Purpose: requests one handler action on an incident: a lifecycle step, an amendment, a reviewer note or a communication record.
// Main members: OperationId, Version, Action, HandlerAccountId, Field, PersonId and Text.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Care;

public class IncidentActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(assign|follow-up|resolve|close|reopen|amend|note|communication)$")]
    public string Action { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? HandlerAccountId { get; set; } = null;

    [RegularExpression("^(Description|ImmediateActions|Witnesses)$")]
    public string? Field { get; set; } = null;

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;

    [StringLength(4000)]
    public string? Text { get; set; } = null;
}
