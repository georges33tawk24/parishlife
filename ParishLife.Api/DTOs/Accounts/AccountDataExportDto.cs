// Purpose: the downloadable copy of a person's own data (privacy page: "a copy of your data"): account, sign-in methods without any
// secret, personal profile and, for each parish where the account is linked to its own person, that parish's own-data view.
// Main members: ExportedAt, Account, CreatedAt, TwoFactorEnabled, Passkeys, ExternalLogins, Profile, PersonalItems, Parishes.

using ParishLife.Api.DTOs.Accounts.Profile;
using ParishLife.Api.DTOs.PersonalWorkspace;

namespace ParishLife.Api.DTOs.Accounts;

public class AccountDataExportDto
{
    public DateTimeOffset ExportedAt { get; set; }

    public AccountDto Account { get; set; } = new();

    public DateTimeOffset CreatedAt { get; set; }

    public bool TwoFactorEnabled { get; set; }

    public List<PasskeyDto> Passkeys { get; set; } = [];

    public List<ExternalLoginDto> ExternalLogins { get; set; } = [];

    public AccountProfileDto? Profile { get; set; }

    public List<PersonalItemDto> PersonalItems { get; set; } = [];

    public List<AccountDataParishDto> Parishes { get; set; } = [];
}
