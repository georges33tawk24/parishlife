namespace ParishLive.Domain.Entities;

/// <summary>A parish belonging to one archdiocese. The tenant boundary — ParishId isolates data.</summary>
public class Parish
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrgId { get; set; }
    public string Name { get; set; } = string.Empty;
}
