// Purpose: one started custom workflow case pinned to the published version and the form answers it was submitted with.
// Main members: Id, ParishId, DefinitionId, VersionId, VersionNumber, Title, StartPermission, Status, Cycle, CurrentStepKey/Permission,
// Answers (standard fields), ProtectedRestrictedAnswers (purpose-bound protected JSON of restricted-field answers), RestrictedFieldKeys,
// Steps and start/update/close attribution.

namespace ParishLife.Api.Models;

public class WorkflowRun
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string DefinitionId { get; set; } = string.Empty;

    public string VersionId { get; set; } = string.Empty;

    public int VersionNumber { get; set; }

    public string Title { get; set; } = string.Empty;

    public string StartPermission { get; set; } = string.Empty;

    public string Status { get; set; } = "InProgress";

    public int Cycle { get; set; } = 1;

    public string? CurrentStepKey { get; set; } = null;

    public string? CurrentStepPermission { get; set; } = null;

    public Dictionary<string, string> Answers { get; set; } = new();

    public string? ProtectedRestrictedAnswers { get; set; } = null;

    public string[] RestrictedFieldKeys { get; set; } = Array.Empty<string>();

    public WorkflowRunStep[] Steps { get; set; } = Array.Empty<WorkflowRunStep>();

    public DateTimeOffset StartedAt { get; set; }

    public string StartedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset? ClosedAt { get; set; } = null;
}
