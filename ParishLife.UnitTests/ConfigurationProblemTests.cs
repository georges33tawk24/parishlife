// Purpose: verifies the startup configuration checks for the optional secret-bearing features (Turnstile, Resend email, external sign-in).
// Main tests: Turnstile_*, Email_*, External_* cover fully off, fully on, half-configured and unresolved Key Vault references;
// Problems_never_echo_the_secret checks that no message contains a configured value.

using ParishLife.Api.Configuration;
using Xunit;

namespace ParishLife.UnitTests;

public sealed class ConfigurationProblemTests
{
    private const string Unresolved = "@Microsoft.KeyVault(SecretUri=https://vault.example.invalid/secrets/name/)";
    private const string FakeSecret = "fixture-value-not-a-secret";

    [Fact]
    public void Turnstile_off_or_complete_is_valid_and_half_or_unresolved_is_not()
    {
        Assert.Null(new TurnstileOptions().ConfigurationProblem());
        Assert.Null(new TurnstileOptions { SiteKey = "site", SecretKey = FakeSecret }.ConfigurationProblem());
        Assert.NotNull(new TurnstileOptions { SiteKey = "site" }.ConfigurationProblem());
        Assert.NotNull(new TurnstileOptions { SecretKey = FakeSecret }.ConfigurationProblem());
        Assert.Contains("Key Vault", new TurnstileOptions { SiteKey = "site", SecretKey = Unresolved }.ConfigurationProblem());
    }

    [Fact]
    public void Email_off_or_complete_is_valid_and_partial_unknown_or_unresolved_is_not()
    {
        Assert.Null(new EmailOptions().ConfigurationProblem());
        Assert.Null(new EmailOptions { Provider = "resend", ResendApiKey = FakeSecret, From = "ParishLife <no-reply@example.invalid>" }.ConfigurationProblem());
        Assert.NotNull(new EmailOptions { Provider = "Resend", ResendApiKey = FakeSecret }.ConfigurationProblem());
        Assert.NotNull(new EmailOptions { ResendApiKey = FakeSecret, From = "a@example.invalid" }.ConfigurationProblem());
        Assert.NotNull(new EmailOptions { Provider = "Smtp", ResendApiKey = FakeSecret, From = "a@example.invalid" }.ConfigurationProblem());
        Assert.Contains("Key Vault", new EmailOptions { Provider = "Resend", ResendApiKey = Unresolved, From = "a@example.invalid" }.ConfigurationProblem());
    }

    [Fact]
    public void External_off_or_complete_is_valid_and_partial_or_unresolved_is_not()
    {
        Assert.Null(new ExternalProviderOptions().ConfigurationProblem("google"));
        Assert.Null(new ExternalProviderOptions { ClientId = "id", ClientSecret = FakeSecret }.ConfigurationProblem("google"));
        Assert.Null(new ExternalProviderOptions { ClientId = "id", UseManagedIdentityAssertion = true }.ConfigurationProblem("microsoft"));
        Assert.NotNull(new ExternalProviderOptions { ClientId = "id" }.ConfigurationProblem("google"));
        Assert.NotNull(new ExternalProviderOptions { ClientId = "id", UseManagedIdentityAssertion = true }.ConfigurationProblem("google"));
        Assert.NotNull(new ExternalProviderOptions { ClientSecret = FakeSecret }.ConfigurationProblem("microsoft"));
        Assert.Contains("Key Vault", new ExternalProviderOptions { ClientId = "id", ClientSecret = Unresolved }.ConfigurationProblem("google"));
    }

    [Fact]
    public void Problems_never_echo_the_secret()
    {
        string?[] problems =
        [
            new TurnstileOptions { SecretKey = FakeSecret }.ConfigurationProblem(),
            new EmailOptions { Provider = "Resend", ResendApiKey = FakeSecret }.ConfigurationProblem(),
            new ExternalProviderOptions { ClientSecret = FakeSecret }.ConfigurationProblem("google")
        ];
        Assert.All(problems, problem => Assert.DoesNotContain(FakeSecret, problem!));
    }
}
