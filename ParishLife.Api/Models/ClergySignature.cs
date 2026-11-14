// Purpose: points to a priest's current signature image in one parish, so replacing or removing it is one versioned change.
// Main members: AccountId, ParishId, CurrentImageId (null when none or removed) and UpdatedAt.

namespace ParishLife.Api.Models;

public class ClergySignature
{
    public string AccountId { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string? CurrentImageId { get; set; } = null;

    public DateTimeOffset UpdatedAt { get; set; }
}
