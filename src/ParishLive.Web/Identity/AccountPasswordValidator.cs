using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Localization;
using ParishLive.Infrastructure.Identity;

namespace ParishLive.Web.Identity;

/// <summary>Apply the reviewed new-credential bounds on every Identity password path, including Manage.</summary>
public sealed class AccountPasswordValidator(IStringLocalizer<SharedResource> text) : IPasswordValidator<ApplicationUser>
{
    private static readonly HashSet<string> Common = new(StringComparer.OrdinalIgnoreCase) {
        "passwordpassword", "1234567890123456", "abcdefghijklmnop", "qwertyuiopasdfgh", "letmeinletmeinletmein" };
    public Task<IdentityResult> ValidateAsync(UserManager<ApplicationUser> manager, ApplicationUser user, string? password)
        => Task.FromResult(password is null || password.Length is < 16 or > 200 || Common.Contains(password)
            ? IdentityResult.Failed(new IdentityError { Code = "PasswordPolicy", Description = text["Auth.PasswordHelp"] })
            : IdentityResult.Success);
}
