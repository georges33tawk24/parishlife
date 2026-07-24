using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

/// <summary>An authorizable action (verb × resource), e.g. "reservations.approve".</summary>
public sealed class Permission : AuditableEntity
{
    private Permission() { }

    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;

    public static Permission Create(string code, string name) => new()
    {
        Code = Guard.Required(code, "Code", 200),
        Name = Guard.Required(name, "Name", 200)
    };
}
