// Purpose: starts a run of the published workflow version the starter viewed, with that version's form answers.
// Main members: OperationId, VersionId (the viewed published version) and Answers keyed by field key.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Workflows;

public class StartWorkflowRunDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid VersionId { get; set; }

    [Required]
    public Dictionary<string, string> Answers { get; set; } = new();
}
