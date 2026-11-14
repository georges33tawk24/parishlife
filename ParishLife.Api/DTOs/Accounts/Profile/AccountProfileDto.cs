// Purpose: projects the current holder's personal account display, interface preferences and self-described details without sign-in or official Person data.
// Main members: DisplayName is personal display text; PreferredLanguage may remain unset; the optional personal details (given/family name and
// town with Arabic twins, address, occupation, about) are the holder's own and never official records; IsConfigured and UpdatedAt distinguish defaults from a saved choice.

namespace ParishLife.Api.DTOs.Accounts.Profile;

public class AccountProfileDto
{
    public string AccountId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? PreferredLanguage { get; set; }

    public AccountAppearanceDto Appearance { get; set; } = new();

    public string? GivenName { get; set; } = null;

    public string? GivenNameAr { get; set; } = null;

    public string? FamilyName { get; set; } = null;

    public string? FamilyNameAr { get; set; } = null;

    public string? Town { get; set; } = null;

    public string? TownAr { get; set; } = null;

    public string? Address { get; set; } = null;

    public string? Occupation { get; set; } = null;

    public string? About { get; set; } = null;

    public bool IsConfigured { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }
}
