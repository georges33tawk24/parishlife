// Purpose: separates actual email confirmation from an explicitly recorded manual identity review.
// Main function: IsVerified checks stored verification facts; a reserved username alone grants no verification.

namespace ParishLife.Api.Identity;

internal static class AccountVerification
{
    internal static bool IsVerified(ParishUser user) => user.EmailConfirmed || user.IdentityVerified && !string.IsNullOrWhiteSpace(user.ContactVerificationReference);
}
