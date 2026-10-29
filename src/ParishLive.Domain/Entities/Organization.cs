namespace ParishLive.Domain.Entities;

/// <summary>The archdiocese — the top of the hierarchy. Owns many parishes.</summary>
public class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? NameFrench { get; set; }
    public string? NameArabic { get; set; }
    public List<Parish> Parishes { get; set; } = new();
}
