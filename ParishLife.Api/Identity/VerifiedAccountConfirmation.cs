// Purpose: applies the account identity-review or confirmed-email policy before allowing sign-in.
// Main function: IsConfirmedAsync checks the shared account-verification rule without treating manual review as email confirmation.

using Microsoft.AspNetCore.Identity;

namespace ParishLife.Api.Identity;

internal sealed class VerifiedAccountConfirmation : IUserConfirmation<ParishUser>
{
    public Task<bool> IsConfirmedAsync(UserManager<ParishUser> manager, ParishUser user) => Task.FromResult(AccountVerification.IsVerified(user));
}
