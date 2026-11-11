// Purpose: verifies X13 optional Turnstile enforcement and the honest public authentication capability endpoint over real HTTP.
// Main tests: default deployment reports nothing configured and enforces nothing; configured Turnstile requires a server-verified
// token on public auth endpoints, exposes only the site key, posts the secret only to the verifier, and fails closed when unreachable.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Services.Accounts;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class AuthenticationCapabilityTests
{
    [Fact]
    public async Task Default_deployment_reports_honest_capabilities_and_enforces_no_turnstile()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        var response = await client.GetAsync("/api/auth/capabilities");
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        var capabilities = await Read<AuthenticationCapabilitiesDto>(response);
        Assert.True(capabilities.PasswordSignIn);
        Assert.True(capabilities.Passkeys);
        Assert.False(capabilities.Turnstile.Enabled);
        Assert.Null(capabilities.Turnstile.SiteKey);
        Assert.Equal("NotConfigured", capabilities.ContactVerificationDelivery);
        Assert.Equal(["google", "microsoft"], capabilities.ExternalProviders.Select(p => p.Provider).Order());
        Assert.All(capabilities.ExternalProviders, p => Assert.False(p.Available));
        await LoginAsync(client, "other@fixture.example"); // No token header needed when Turnstile is not configured.
    }

    [Fact]
    public async Task Configured_turnstile_verifies_tokens_server_side_on_public_auth_endpoints_and_fails_closed()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var reachable = true;
        var verifier = new RoutedHandler(async request =>
        {
            if (!reachable)
                throw new HttpRequestException("isolated verifier outage");
            var form = await request.Content!.ReadAsStringAsync();
            return RoutedHandler.Json(form.Contains("response=good-token", StringComparison.Ordinal)
                ? """{"success":true,"hostname":"localhost"}""" : """{"success":false,"error-codes":["invalid-input-response"]}""");
        });
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new()
        {
            ["Turnstile:SiteKey"] = "isolated-site-key",
            ["Turnstile:SecretKey"] = "isolated-turnstile-secret",
            ["Turnstile:ExpectedHostname"] = "localhost"
        }, services => services.AddHttpClient(TurnstileVerifier.ClientName).ConfigurePrimaryHttpMessageHandler(() => verifier));
        using var client = factory.Client();
        var body = await (await client.GetAsync("/api/auth/capabilities")).Content.ReadAsStringAsync();
        Assert.Contains("isolated-site-key", body, StringComparison.Ordinal);
        Assert.DoesNotContain("isolated-turnstile-secret", body, StringComparison.Ordinal);

        await Csrf(client);
        var login = new { username = "other@fixture.example", password = Password };
        Assert.Equal("turnstile_failed", await Title(await client.PostAsJsonAsync("/api/auth/login", login)));
        client.DefaultRequestHeaders.Add(TurnstileVerifier.Header, "bad-token");
        Assert.Equal("turnstile_failed", await Title(await client.PostAsJsonAsync("/api/auth/login", login)));
        Assert.Equal("turnstile_failed", await Title(await client.PostAsJsonAsync("/api/auth/register", new RegisterAccountDto
        { OperationId = Guid.NewGuid(), Email = "bot@fixture.example", Password = Password, DisplayName = "Bot" })));
        Assert.Equal("turnstile_failed", await Title(await client.PostAsJsonAsync("/api/auth/contact-verification", new { email = "bot@fixture.example" })));
        Assert.Equal("turnstile_failed", await Title(await client.PostAsync("/api/auth/login/passkey/options", null)));
        client.DefaultRequestHeaders.Remove(TurnstileVerifier.Header);
        client.DefaultRequestHeaders.Add(TurnstileVerifier.Header, "good-token");
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/login", login)).StatusCode);
        // The secret goes only to the verifier, form-encoded; it is never echoed to clients.
        Assert.All(verifier.Requests, request => Assert.Contains("secret=isolated-turnstile-secret", request.Body, StringComparison.Ordinal));
        // An unreachable verifier fails closed.
        reachable = false;
        var outage = await client.PostAsJsonAsync("/api/auth/login", login);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, outage.StatusCode);
        Assert.Equal("turnstile_unavailable", await Title(outage));
    }
}
