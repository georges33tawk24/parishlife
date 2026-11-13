// Purpose: one account id that a parish record carries, resolved to the display name the caller may see.
// Main members: AccountId and DisplayName.

namespace ParishLife.Api.DTOs.People;

public class AccountNameDto
{
    public string AccountId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;
}
