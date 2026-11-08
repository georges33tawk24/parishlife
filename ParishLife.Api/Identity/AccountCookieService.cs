// Purpose: issues an Identity cookie whose authentication method exactly matches the committed server-side session.
// Main function: IssueAsync copies only the stored session ID and method; recovery sessions cannot claim authenticator MFA.

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;

namespace ParishLife.Api.Identity;

public class AccountCookieService(SignInManager<ParishUser> signIn)
{
    public Task IssueAsync(ParishUser user, AccountSession session) => signIn.SignInWithClaimsAsync(user,
        new AuthenticationProperties { IsPersistent = false, ExpiresUtc = session.ExpiresAt, AllowRefresh = false },
        [new Claim("sid", session.Id), new Claim("amr", session.AuthenticationMethod)]);
}
