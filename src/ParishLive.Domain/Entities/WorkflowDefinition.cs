using ParishLive.Domain.Common;
using ParishLive.Domain.Enums;

namespace ParishLive.Domain.Entities;

/// <summary>
/// A configurable workflow (e.g. the parish reservation approval chain). Because it lives in the
/// database — states + transitions per definition — a parish can add approval levels without code
/// changes, which is exactly what the spec asks for. ParishId null = an archdiocese-wide default.
/// Pattern adopted from the ParishLife reference.
/// </summary>
public sealed class WorkflowDefinition : AuditableEntity
{
    private WorkflowDefinition() { }

    public Guid? ParishId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public WorkflowEntityType EntityType { get; private set; }
    public int Version { get; private set; }
    public bool IsActive { get; private set; }

    public static WorkflowDefinition Create(
        Guid? parishId, string code, string name, WorkflowEntityType entityType, int version, bool isActive) => new()
    {
        ParishId = parishId,
        Code = Guard.Required(code, "Code", 200),
        Name = Guard.Required(name, "Name", 200),
        EntityType = entityType,
        Version = version,
        IsActive = isActive
    };
}
