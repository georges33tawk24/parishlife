// Purpose: returns a safe account profile without exposing private Identity state.
// Main members: Id, DisplayName, Email, EmailConfirmed, Username, AccountVerified; From maps only safe account fields.

using ParishLife.Api.Identity;

namespace ParishLife.Api.DTOs.Accounts;

public class AccountDto
{
    public string Id { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? Email { get; set; }

    public bool EmailConfirmed { get; set; }

    public string? Username { get; set; } = null;

    public bool AccountVerified { get; set; } = false;

    public static AccountDto From(ParishUser user) => new()
    {
        Id = user.Id,
        DisplayName = user.DisplayName,
        Email = user.Email,
        EmailConfirmed = user.EmailConfirmed,
        Username = user.UserName,
        AccountVerified = AccountVerification.IsVerified(user)
    };
}
