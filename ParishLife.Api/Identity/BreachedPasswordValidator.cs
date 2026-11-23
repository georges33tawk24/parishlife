// Purpose: refuses a new password that appears in known data breaches (owner decision, 23 November 2026) through the Have I Been Pwned
// range API with k-anonymity: only the first 5 characters of the password's SHA-1 hash leave the server (never the password or its full
// hash), and the answer is padded so its size reveals nothing. On by default in Production only, so tests and development never call out;
// PasswordBreachCheck:Enabled overrides it. If the service is slow or unreachable (3 s), the password is accepted: the check never blocks
// a sign-up or a reset.
// Main members: ClientName, ErrorCode, ValidateAsync (Identity runs it for sign-up, password change, add and reset), ThrowIfBreached.

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Models;

namespace ParishLife.Api.Identity;

public sealed class BreachedPasswordValidator(IHttpClientFactory clients, IConfiguration configuration, IHostEnvironment environment,
    ILogger<BreachedPasswordValidator> logger) : IPasswordValidator<ParishUser>
{
    public const string ClientName = "PwnedPasswords";
    public const string ErrorCode = "PasswordBreached";
    internal static readonly Uri Endpoint = new("https://api.pwnedpasswords.com/range/");

    public async Task<IdentityResult> ValidateAsync(UserManager<ParishUser> manager, ParishUser user, string? password)
    {
        // Too short a password is refused by the length rule anyway; it is not worth a request.
        if (string.IsNullOrEmpty(password) || password.Length < manager.Options.Password.RequiredLength
            || !(configuration.GetValue<bool?>("PasswordBreachCheck:Enabled") ?? environment.IsProduction()))
            return IdentityResult.Success;
        return await BreachedAsync(password)
            ? IdentityResult.Failed(new IdentityError { Code = ErrorCode, Description = "This password appears in a known data breach." })
            : IdentityResult.Success;
    }

    // The callers turn Identity's result into the API's error; a breached password gets its own plain message.
    internal static void ThrowIfBreached(IdentityResult result)
    {
        if (result.Errors.Any(error => error.Code == ErrorCode))
            throw new DomainException("password_breached",
                "This password has appeared in a known data breach, so it could be guessed. Choose a different one.");
    }

    private async Task<bool> BreachedAsync(string password)
    {
#pragma warning disable CA5350 // SHA-1 is the range API's lookup format, not a protection: only 5 of its 40 characters are sent.
        var hash = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(password)));
#pragma warning restore CA5350
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(Endpoint, hash[..5]));
            request.Headers.Add("Add-Padding", "true");
            using var response = await clients.CreateClient(ClientName).SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return false;
            var suffix = hash[5..];
            foreach (var line in (await response.Content.ReadAsStringAsync()).Split('\n'))
                if (line.Length > 36 && line[35] == ':' && line.AsSpan(0, 35).Equals(suffix, StringComparison.OrdinalIgnoreCase)
                    && int.TryParse(line.AsSpan(36).Trim(), out var count) && count > 0) // padding lines have a count of 0
                    return true;
            return false;
        }
        catch (Exception failure) when (failure is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning("Breached-password check unavailable ({Failure}); the password was accepted.", failure.GetType().Name);
            return false;
        }
    }
}
