// Purpose: represents a real parish fund with its purpose and restriction, configured by finance owners.
// Main members: Id, ParishId, Name, NameAr, Purpose, PurposeAr, Restricted, Status, CreatedBy and CreatedAt.

namespace ParishLife.Api.Models;

public class Fund
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    // Optional Arabic twin, typed by the office; never translated from Name.
    public string? NameAr { get; set; } = null;

    public string Purpose { get; set; } = string.Empty;

    public string? PurposeAr { get; set; } = null;

    public bool Restricted { get; set; }

    // Active or Closed.
    public string Status { get; set; } = "Active";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
