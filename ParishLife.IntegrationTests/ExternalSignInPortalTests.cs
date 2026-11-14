// Purpose: verifies the portal path of optional external sign-in (A06) over real HTTP with an isolated stand-in provider.
// Main tests: linking through a proof-checked ticket and a credential-free form post bound to the same session; the portal round trip
// returns to the fixed portal page with a status word only; a two-factor challenge is handed over once from a protected cookie and
// still needs the authenticator; unlinked subjects return "not-linked"; the bot-check token is accepted as a form field.

using System.Net;
using System.Net.Http.Json;
using System.Web;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Services.Accounts;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class ExternalSignInPortalTests
{
    [Fact]
    public async Task Portal_links_with_a_session_bound_ticket_and_sign_in_hands_over_the_two_factor_step_once()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = Provider(f, "portal-subject-1");
        using var owner = factory.Client();
        await LoginAsync(owner, "other@fixture.example");
        Assert.Equal("credentials_invalid", await Title(await owner.PostAsJsonAsync("/api/auth/external/google/link/ticket",
            new LinkExternalLoginDto { CurrentPassword = Password })));
        Assert.Equal("external_provider_unavailable", await Title(await owner.PostAsJsonAsync("/api/auth/external/microsoft/link/ticket",
            new LinkExternalLoginDto { CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() })));
        var ticket = await Read<ExternalLinkTicketDto>(await owner.PostAsJsonAsync("/api/auth/external/google/link/ticket",
            new LinkExternalLoginDto { CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() }));
        Assert.DoesNotContain(Password, ticket.Ticket, StringComparison.Ordinal);

        // The same account signed in elsewhere (another session) cannot use this ticket, and a altered ticket is refused.
        using var elsewhere = factory.Client();
        await LoginAsync(elsewhere, "other@fixture.example");
        Assert.Equal("external_link_ticket_invalid", await Title(await elsewhere.PostAsync("/api/auth/external/google/link/redirect", Form(("ticket", ticket.Ticket)))));
        Assert.Equal("external_link_ticket_invalid", await Title(await owner.PostAsync("/api/auth/external/google/link/redirect", Form(("ticket", ticket.Ticket + "x")))));
        Assert.Equal("external_provider_unavailable", await Title(await owner.PostAsync("/api/auth/external/microsoft/link/redirect", Form(("ticket", ticket.Ticket)))));

        var linked = await RoundTripAsync(owner, await owner.PostAsync("/api/auth/external/google/link/redirect", Form(("ticket", ticket.Ticket), ("returnTo", "portal"))));
        Assert.Equal(HttpStatusCode.Redirect, linked.StatusCode);
        Assert.Equal("/index.html?external=linked", linked.Headers.Location!.OriginalString);
        Assert.Equal("google", Assert.Single(await Read<List<ExternalLoginDto>>(await owner.GetAsync("/api/auth/external"))).Provider);

        using var browser = factory.Client();
        await Csrf(browser);
        var returned = await RoundTripAsync(browser, await browser.PostAsync("/api/auth/external/google/sign-in", Form(("returnTo", "portal"))));
        Assert.Equal("/index.html?external=two-factor", returned.Headers.Location!.OriginalString);
        Assert.DoesNotContain("challenge", returned.Headers.Location!.OriginalString, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.GetAsync("/api/auth/me")).StatusCode);
        await Csrf(browser);
        var held = await Read<MfaLoginChallengeDto>(await browser.PostAsync("/api/auth/external/pending-challenge", null));
        Assert.Equal(f.Other, held.AccountId);
        Assert.Equal("external_challenge_not_found", await Title(await browser.PostAsync("/api/auth/external/pending-challenge", null)));
        // The handed-over challenge is only a challenge: a wrong code does not sign in, the authenticator code does.
        Assert.False((await browser.PostAsJsonAsync("/api/auth/login/mfa", new { accountId = held.AccountId, challenge = held.Challenge, code = "000000" })).IsSuccessStatusCode);
        await Read<AccountDto>(await browser.PostAsJsonAsync("/api/auth/login/mfa", new { accountId = held.AccountId, challenge = held.Challenge, code = TestAuthenticator.Code() }));
        Assert.Equal(f.Other, (await Read<AccountDto>(await browser.GetAsync("/api/auth/me"))).Id);
    }

    [Fact]
    public async Task Portal_round_trip_for_an_unlinked_subject_returns_not_linked_and_creates_nothing()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = Provider(f, "portal-subject-unlinked");
        using var browser = factory.Client();
        await Csrf(browser);
        var returned = await RoundTripAsync(browser, await browser.PostAsync("/api/auth/external/google/sign-in", Form(("returnTo", "portal"))));
        Assert.Equal("/index.html?external=not-linked", returned.Headers.Location!.OriginalString);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.GetAsync("/api/auth/me")).StatusCode);
        await Csrf(browser);
        Assert.Equal("external_challenge_not_found", await Title(await browser.PostAsync("/api/auth/external/pending-challenge", null)));
        // Any other returnTo keeps the JSON answer.
        await Csrf(browser);
        var json = await RoundTripAsync(browser, await browser.PostAsync("/api/auth/external/google/sign-in", Form(("returnTo", "https://elsewhere.example/"))));
        Assert.Equal(HttpStatusCode.Unauthorized, json.StatusCode);
    }

    [Fact]
    public async Task Configured_bot_check_accepts_its_token_as_a_form_field_on_the_external_sign_in_post()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var verifier = new RoutedHandler(async request => RoutedHandler.Json((await request.Content!.ReadAsStringAsync()).Contains("response=good-token", StringComparison.Ordinal)
            ? """{"success":true,"hostname":"localhost"}""" : """{"success":false}"""));
        await using var factory = Provider(f, "portal-subject-2", new()
        {
            ["Turnstile:SiteKey"] = "isolated-site-key",
            ["Turnstile:SecretKey"] = "isolated-turnstile-secret",
            ["Turnstile:ExpectedHostname"] = "localhost"
        }, services => services.AddHttpClient(TurnstileVerifier.ClientName).ConfigurePrimaryHttpMessageHandler(() => verifier));
        using var browser = factory.Client();
        await Csrf(browser);
        Assert.Equal("turnstile_failed", await Title(await browser.PostAsync("/api/auth/external/google/sign-in", Form(("returnTo", "portal")))));
        Assert.Equal("turnstile_failed", await Title(await browser.PostAsync("/api/auth/external/google/sign-in", Form(("turnstileToken", "bad-token")))));
        var challenge = await browser.PostAsync("/api/auth/external/google/sign-in", Form(("turnstileToken", "good-token"), ("returnTo", "portal")));
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        Assert.Equal("accounts.google.com", challenge.Headers.Location!.Host);
    }

    private static FormUrlEncodedContent Form(params (string Name, string Value)[] fields)
        => new(fields.Select(field => new KeyValuePair<string, string>(field.Name, field.Value)));

    private static ConfiguredApiFactory Provider(LocalBackendFixture f, string subject, Dictionary<string, string?>? extra = null, Action<IServiceCollection>? more = null)
    {
        var provider = new RoutedHandler(request => Task.FromResult(request.RequestUri!.AbsolutePath.EndsWith("/token", StringComparison.Ordinal)
            ? RoutedHandler.Json("""{"access_token":"isolated-access","token_type":"Bearer","expires_in":3600}""")
            : RoutedHandler.Json("{\"sub\":\"" + subject + "\",\"email\":\"other@fixture.example\",\"email_verified\":true}")));
        var settings = new Dictionary<string, string?>
        {
            ["ExternalSignIn:google:ClientId"] = "isolated-client",
            ["ExternalSignIn:google:ClientSecret"] = "isolated-client-secret"
        };
        foreach (var (key, value) in extra ?? [])
            settings[key] = value;
        return new ConfiguredApiFactory(f.DirectoryPath, settings, services =>
        {
            services.Configure<OAuthOptions>("external-google", options => options.BackchannelHttpHandler = provider);
            more?.Invoke(services);
        });
    }

    private static async Task<HttpResponseMessage> RoundTripAsync(HttpClient client, HttpResponseMessage challenge)
    {
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        var authorize = challenge.Headers.Location!;
        Assert.Equal("accounts.google.com", authorize.Host);
        var query = HttpUtility.ParseQueryString(authorize.Query);
        var callback = await client.GetAsync($"/api/auth/external/callback/google?code=isolated-code&state={Uri.EscapeDataString(query["state"]!)}");
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        return await client.GetAsync(callback.Headers.Location!.OriginalString);
    }
}
