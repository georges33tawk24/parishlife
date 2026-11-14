// Purpose: one clergy title of the operator-maintained list, with its optional Arabic twin.
// Main members: Id, Title, TitleAr, Retired, CreatedAt, UpdatedAt and UpdatedBy.

namespace ParishLife.Api.DTOs.Administration;

public class ClergyTitleDto
{
    public string Id { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public bool Retired { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;
}
