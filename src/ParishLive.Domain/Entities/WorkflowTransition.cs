using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>
/// An allowed move from one state to another, driven by an action. Carries the permission required to
/// perform it and whether a note/reason is mandatory (e.g. Reject requires a reason — a spec rule now
/// enforced by data, not hard-coded). The set of transitions IS the state machine.
/// </summary>
public sealed class WorkflowTransition : AuditableEntity
{
    private WorkflowTransition() { }

    public Guid WorkflowDefinitionId { get; private set; }
    public Guid FromStateId { get; private set; }
    public Guid ToStateId { get; private set; }
    public string ActionCode { get; private set; } = string.Empty;
    public string ActionName { get; private set; } = string.Empty;
    public string? RequiredPermissionCode { get; private set; }
    public bool RequiresNote { get; private set; }
    public bool IsActive { get; private set; }

    public static WorkflowTransition Create(
        Guid workflowDefinitionId, Guid fromStateId, Guid toStateId,
        string actionCode, string actionName, string? requiredPermissionCode, bool requiresNote, bool isActive) => new()
    {
        WorkflowDefinitionId = Guard.NotEmpty(workflowDefinitionId, "WorkflowDefinitionId"),
        FromStateId = Guard.NotEmpty(fromStateId, "FromStateId"),
        ToStateId = Guard.NotEmpty(toStateId, "ToStateId"),
        ActionCode = Guard.Required(actionCode, "ActionCode", 200),
        ActionName = Guard.Required(actionName, "ActionName", 200),
        RequiredPermissionCode = Guard.Optional(requiredPermissionCode, "RequiredPermissionCode", 200),
        RequiresNote = requiresNote,
        IsActive = isActive
    };
}
