using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>A status a record can be in within a workflow (e.g. "Under secretary review").</summary>
public sealed class WorkflowState : AuditableEntity
{
    private WorkflowState() { }

    public Guid WorkflowDefinitionId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public int Sequence { get; private set; }
    public bool IsInitial { get; private set; }
    public bool IsTerminal { get; private set; }

    public static WorkflowState Create(
        Guid workflowDefinitionId, string code, string name, int sequence, bool isInitial, bool isTerminal) => new()
    {
        WorkflowDefinitionId = Guard.NotEmpty(workflowDefinitionId, "WorkflowDefinitionId"),
        Code = Guard.Required(code, "Code", 200),
        Name = Guard.Required(name, "Name", 200),
        Sequence = sequence,
        IsInitial = isInitial,
        IsTerminal = isTerminal
    };
}
