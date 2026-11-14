// Purpose: one clergy title in the platform's operator-maintained list; the list starts empty and holds only titles an operator typed in.
// Main members: Id, Title, TitleAr (optional Arabic twin), Retired, CreatedAt, CreatedBy, UpdatedAt and UpdatedBy.

namespace ParishLife.Api.Models;

public class ClergyTitle
{
    public string Id { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public bool Retired { get; set; } = false;

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;
}
