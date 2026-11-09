// Purpose: projects the current holder's personal account display and interface preferences without sign-in or official Person data.
// Main members: DisplayName is personal display text; PreferredLanguage may remain unset; IsConfigured and UpdatedAt distinguish defaults from a saved choice.

namespace ParishLife.Api.DTOs.Accounts.Profile;

public class AccountProfileDto
{
    public string AccountId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? PreferredLanguage { get; set; }

    public AccountAppearanceDto Appearance { get; set; } = new();

    public bool IsConfigured { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
