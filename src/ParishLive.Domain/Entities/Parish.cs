namespace ParishLive.Domain.Entities;

/// <summary>A parish belonging to one archdiocese. The tenant boundary — ParishId isolates data.</summary>
public class Parish
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrgId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? NameFrench { get; set; }
    public string? NameArabic { get; set; }
    public string? Locality { get; set; }
    public string? OfficeContact { get; set; }
    public bool PubliclyListed { get; set; }
    public string Lifecycle { get; set; } = "Active";
    public string TimeZone { get; set; } = "Asia/Beirut";
    public string? Jurisdiction { get; set; }
    public string? AdoptionReference { get; set; }
    public string Bundle { get; set; } = "Complete";
    public string? SuspendedByRole { get; set; }
    public bool GuestIntakeEnabled { get; set; }
    public string GuestRequestKindsJson { get; set; } = "[\"General\"]";
}
