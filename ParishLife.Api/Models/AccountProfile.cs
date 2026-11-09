// Purpose: stores only one account holder's personal interface preferences, separate from official Person records.
// Main members: AccountId identifies the private owner; PreferredLanguage and appearance fields retain explicit choices; UpdatedAt records the save.

namespace ParishLife.Api.Models;

public class AccountProfile
{
    public string AccountId { get; set; } = string.Empty;

    public string? PreferredLanguage { get; set; }

    public string Mode { get; set; } = "light";

    public string Scheme { get; set; } = "forest";

    public string PrimaryColor { get; set; } = "#233B32";

    public DateTimeOffset UpdatedAt { get; set; }
}
