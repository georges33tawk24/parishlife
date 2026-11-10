// Purpose: authorized projection of a workflow run; restricted-field answers appear only for permitted readers, otherwise their keys are listed as redacted.
// Main members: Id, DefinitionId, VersionId, VersionNumber, Title, Status, Cycle, CurrentStepKey, Answers, RedactedFieldKeys, Steps and attribution.

namespace ParishLife.Api.DTOs.Workflows;

public class WorkflowRunDto
{
    public string Id { get; set; } = string.Empty;

    public string DefinitionId { get; set; } = string.Empty;

    public string VersionId { get; set; } = string.Empty;

    public int VersionNumber { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public int Cycle { get; set; }

    public string? CurrentStepKey { get; set; } = null;

    public Dictionary<string, string> Answers { get; set; } = new();

    public string[] RedactedFieldKeys { get; set; } = Array.Empty<string>();

    public WorkflowRunStepDto[] Steps { get; set; } = Array.Empty<WorkflowRunStepDto>();

    public DateTimeOffset StartedAt { get; set; }

    public string StartedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset? ClosedAt { get; set; } = null;
}
