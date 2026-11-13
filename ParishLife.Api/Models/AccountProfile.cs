// Purpose: stores only one account holder's personal interface preferences and self-described account details, separate from official Person records.
// Main members: AccountId identifies the private owner; PreferredLanguage and appearance fields retain explicit choices; the optional
// personal details (names and town with Arabic twins, address, occupation, about) are visible to the holder only; UpdatedAt records the save.

namespace ParishLife.Api.Models;

public class AccountProfile
{
    public string AccountId { get; set; } = string.Empty;

    public string? PreferredLanguage { get; set; }

    public string Mode { get; set; } = "light";

    public string Scheme { get; set; } = "forest";

    public string PrimaryColor { get; set; } = "#233B32";

    public string? GivenName { get; set; } = null;

    public string? GivenNameAr { get; set; } = null;

    public string? FamilyName { get; set; } = null;

    public string? FamilyNameAr { get; set; } = null;

    public string? Town { get; set; } = null;

    public string? TownAr { get; set; } = null;

    public string? Address { get; set; } = null;

    public string? Occupation { get; set; } = null;

    public string? About { get; set; } = null;

    public DateTimeOffset UpdatedAt { get; set; }
}
