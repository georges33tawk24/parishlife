// Purpose: represents a real parish fund with its purpose and restriction, configured by finance owners.
// Main members: Id, ParishId, Name, Purpose, Restricted, Status, CreatedBy and CreatedAt.

namespace ParishLife.Api.Models;

public class Fund
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public bool Restricted { get; set; }

    // Active or Closed.
    public string Status { get; set; } = "Active";

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
