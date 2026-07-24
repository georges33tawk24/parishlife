namespace ParishLive.Domain.Common;

/// <summary>Base for all entities — a Guid identity. (Adopted from the ParishLife reference.)</summary>
public abstract class Entity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
}
