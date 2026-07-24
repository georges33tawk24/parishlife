using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>
/// A named role that grants a configurable set of permissions (via RolePermission). ParishId null = an
/// archdiocese-wide default role; a parish can create its own to reconfigure who may do what.
/// </summary>
public sealed class Role : AuditableEntity
{
    private Role() { }

    public Guid? ParishId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;

    public static Role Create(Guid? parishId, string code, string name) => new()
    {
        ParishId = parishId,
        Code = Guard.Required(code, "Code", 200),
        Name = Guard.Required(name, "Name", 200)
    };
}
