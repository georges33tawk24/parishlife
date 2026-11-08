// Purpose: retains ASP.NET Core Identity behavior while exposing its recovery-code generator for staged atomic account writes.
// Main functions: CreateRecoveryCodes stages framework-generated codes; CreateSecurityStamp stages an Identity-generated security version.

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace ParishLife.Api.Identity;

public class ParishUserManager(IUserStore<ParishUser> store, IOptions<IdentityOptions> options,
    IPasswordHasher<ParishUser> passwordHasher, IEnumerable<IUserValidator<ParishUser>> userValidators,
    IEnumerable<IPasswordValidator<ParishUser>> passwordValidators, ILookupNormalizer normalizer,
    IdentityErrorDescriber errors, IServiceProvider services, ILogger<UserManager<ParishUser>> logger)
    : UserManager<ParishUser>(store, options, passwordHasher, userValidators, passwordValidators, normalizer, errors, services, logger)
{
    internal string[] CreateRecoveryCodes()
        => Enumerable.Range(0, 10).Select(_ => CreateTwoFactorRecoveryCode()).Distinct(StringComparer.Ordinal).ToArray();

    internal string CreateSecurityStamp() => GenerateNewAuthenticatorKey();
}
