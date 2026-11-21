// Purpose: verifies Google/Microsoft sign-up (owner decisions of 19 November 2026) over real HTTP with an isolated stand-in provider.
// Main tests: sign-up creates one passwordless account with the provider-verified email confirmed, a member session and no Person or
// membership, and the same subject later just signs in; it never merges (an email already held creates nothing: email-in-use); an
// unverified email creates nothing (not-verified); the only sign-in method cannot be unlinked; "Add a password" needs a provider
// sign-in of this session within ten minutes, then the password signs in and unlinking is allowed; Microsoft redeems the code with
// the managed-identity client assertion (no secret sent) and its email counts only under the personal-account / xms_edov rule.

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Web;
using Azure.Core;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class ExternalSignUpTests
{
    private const string NewPassword = "isolated-added-long-password";

    [Fact]
    public async Task Sign_up_creates_one_passwordless_confirmed_account_and_the_subject_then_signs_in()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = Google(f, """{"sub":"signup-subject-1","email":"new.person@fixture.example","email_verified":true,"name":"New Person"}""");
        using var browser = factory.Client();
        await Csrf(browser);
        var returned = await RoundTripAsync(browser, "google", await browser.PostAsync("/api/auth/external/google/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true"))));
        Assert.Equal("/index.html?external=signed-up", returned.Headers.Location!.OriginalString);
        var me = await Read<AccountDto>(await browser.GetAsync("/api/auth/me"));
        Assert.Equal("new.person@fixture.example", me.Email);
        Assert.Equal("New Person", me.DisplayName);
        Assert.True(me.EmailConfirmed);
        Assert.False(me.HasPassword);

        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var account = (await users.FindByIdAsync(me.Id))!;
        Assert.Null(account.PasswordHash);
        Assert.False(account.TwoFactorEnabled || account.PlatformOperator);
        var login = Assert.Single(account.ExternalLogins);
        Assert.Equal("google", login.Provider);
        Assert.DoesNotContain("signup-subject-1", login.SubjectHash, StringComparison.Ordinal);
        // A plain member account: no Person, membership or capacity comes with it.
        Assert.Equal(0, (await Read<JsonElement>(await browser.GetAsync("/api/me/parishes"))).GetArrayLength());
        Assert.Equal(0, (await Read<JsonElement>(await browser.GetAsync("/api/me/capacities"))).GetArrayLength());

        // The same subject later: sign-up and sign-in both simply sign in to the same account; no second account is made.
        await using var next = Google(f, """{"sub":"signup-subject-1","email":"new.person@fixture.example","email_verified":true}""");
        using var again = next.Client();
        await Csrf(again);
        Assert.Equal("/index.html?external=signed-in",
            (await RoundTripAsync(again, "google", await again.PostAsync("/api/auth/external/google/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true"))))).Headers.Location!.OriginalString);
        Assert.Equal(me.Id, (await Read<AccountDto>(await again.GetAsync("/api/auth/me"))).Id);
        using var signIn = next.Client();
        await Csrf(signIn);
        Assert.Equal("/index.html?external=signed-in",
            (await RoundTripAsync(signIn, "google", await signIn.PostAsync("/api/auth/external/google/sign-in", Form(("returnTo", "portal"))))).Headers.Location!.OriginalString);
        Assert.Equal(me.Id, (await users.FindByEmailAsync("new.person@fixture.example"))!.Id);
    }

    [Fact]
    public async Task Sign_up_never_merges_into_an_account_that_holds_the_email_and_refuses_an_unverified_email()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var holder = (await users.FindByEmailAsync("other@fixture.example"))!;

        await using var factory = Google(f, """{"sub":"signup-subject-taken","email":"other@fixture.example","email_verified":true}""");
        using var browser = factory.Client();
        await Csrf(browser);
        var returned = await RoundTripAsync(browser, "google", await browser.PostAsync("/api/auth/external/google/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true"))));
        Assert.Equal("/index.html?external=email-in-use", returned.Headers.Location!.OriginalString);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.GetAsync("/api/auth/me")).StatusCode);
        var after = (await users.FindByIdAsync(holder.Id))!;
        Assert.Empty(after.ExternalLogins); // nothing was linked to the holder
        Assert.Equal(holder.Id, (await users.FindByEmailAsync("other@fixture.example"))!.Id);
        // The subject stays unknown: signing in with it still says not-linked, and the JSON answer names the refusal.
        await Csrf(browser);
        Assert.Equal("/index.html?external=not-linked",
            (await RoundTripAsync(browser, "google", await browser.PostAsync("/api/auth/external/google/sign-in", Form(("returnTo", "portal"))))).Headers.Location!.OriginalString);
        await Csrf(browser);
        Assert.Equal("external_email_in_use", await Title(await RoundTripAsync(browser, "google", await browser.PostAsync("/api/auth/external/google/sign-up", Form(("ageConfirmed", "true"))))));

        await using var unverified = Google(f, """{"sub":"signup-subject-unverified","email":"unverified@fixture.example","email_verified":false}""");
        using var other = unverified.Client();
        await Csrf(other);
        Assert.Equal("/index.html?external=not-verified",
            (await RoundTripAsync(other, "google", await other.PostAsync("/api/auth/external/google/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true"))))).Headers.Location!.OriginalString);
        Assert.Null(await users.FindByEmailAsync("unverified@fixture.example"));
        Assert.Null(await users.FindByNameAsync("unverified@fixture.example"));
    }

    [Fact]
    public async Task Only_method_cannot_be_unlinked_and_adding_a_password_needs_a_fresh_provider_sign_in()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var clock = new ShiftedClock();
        const string userinfo = """{"sub":"signup-subject-2","email":"passwordless@fixture.example","email_verified":true}""";
        await using var factory = Google(f, userinfo, clock);
        using var browser = factory.Client();
        await Csrf(browser);
        await RoundTripAsync(browser, "google", await browser.PostAsync("/api/auth/external/google/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true"))));
        await Csrf(browser);

        // The last usable sign-in method: refused with a clear reason, before any password is asked for.
        Assert.Equal("last_sign_in_method", await Title(await browser.PostAsJsonAsync("/api/auth/external/google/unlink",
            new UnlinkExternalLoginDto { OperationId = Guid.NewGuid(), CurrentPassword = "x" })));
        // A password change needs the current password, which this account does not have.
        Assert.Equal("credentials_invalid", await Title(await browser.PostAsJsonAsync("/api/auth/password",
            new ChangeAccountPasswordDto { OperationId = Guid.NewGuid(), CurrentPassword = "nothing-to-prove-here", NewPassword = NewPassword })));

        // Eleven minutes later the provider sign-in is no longer fresh enough to stand in for a password.
        clock.Offset = TimeSpan.FromMinutes(11);
        var add = new AddAccountPasswordDto { OperationId = Guid.NewGuid(), NewPassword = NewPassword };
        Assert.Equal("fresh_external_sign_in_required", await Title(await browser.PostAsJsonAsync("/api/auth/password/add", add)));

        // A fresh provider sign-in: the password is added, every session ends, and the password then signs in.
        using var fresh = factory.Client();
        await Csrf(fresh);
        await RoundTripAsync(fresh, "google", await fresh.PostAsync("/api/auth/external/google/sign-in", Form(("returnTo", "portal"))));
        await Csrf(fresh);
        Assert.Equal("Added", (await Read<PasswordChangeResultDto>(await fresh.PostAsJsonAsync("/api/auth/password/add", add))).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await fresh.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.GetAsync("/api/auth/me")).StatusCode);

        await using var next = Google(f, userinfo, clock);
        using var withPassword = next.Client();
        await LoginAsync(withPassword, "passwordless@fixture.example", NewPassword);
        Assert.True((await Read<AccountDto>(await withPassword.GetAsync("/api/auth/me"))).HasPassword);
        Assert.Equal("password_exists", await Title(await withPassword.PostAsJsonAsync("/api/auth/password/add",
            new AddAccountPasswordDto { OperationId = Guid.NewGuid(), NewPassword = NewPassword + "-again" })));
        // With a password the provider is no longer the only method, so unlinking (with the password as proof) is allowed.
        Assert.Equal("Applied", (await Read<AccountSecurityChangeDto>(await withPassword.PostAsJsonAsync("/api/auth/external/google/unlink",
            new UnlinkExternalLoginDto { OperationId = Guid.NewGuid(), CurrentPassword = NewPassword }))).Status);
    }

    [Fact]
    public async Task Microsoft_redeems_the_code_with_the_managed_identity_assertion_and_trusts_only_a_verified_email()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        // A personal Microsoft account (consumer tenant): Microsoft verified the address, so sign-up may use it.
        var (factory, provider) = Microsoft(f, "ms-subject-personal", ExternalIdentityClaims.ConsumerTenant, "ms.person@fixture.example", edov: false);
        await using (factory)
        {
            using var browser = factory.Client();
            await Csrf(browser);
            var returned = await RoundTripAsync(browser, "microsoft", await browser.PostAsync("/api/auth/external/microsoft/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true"))));
            Assert.Equal("/index.html?external=signed-up", returned.Headers.Location!.OriginalString);
            Assert.Equal("ms.person@fixture.example", (await Read<AccountDto>(await browser.GetAsync("/api/auth/me"))).Email);
            var token = Assert.Single(provider.Requests, request => request.Uri.EndsWith("/token", StringComparison.Ordinal)).Body;
            Assert.Contains("client_assertion=isolated-managed-identity-token", token, StringComparison.Ordinal);
            Assert.Contains("client_assertion_type=urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer", token, StringComparison.Ordinal);
            Assert.DoesNotContain("client_secret", token, StringComparison.Ordinal);
            Assert.Contains("code_verifier=", token, StringComparison.Ordinal);
        }

        // A work or school account without xms_edov: Microsoft does not vouch for the address, so nothing is created.
        var (organization, _) = Microsoft(f, "ms-subject-work", "11111111-2222-3333-4444-555555555555", "someone@fixture.example", edov: false);
        await using (organization)
        {
            using var browser = organization.Client();
            await Csrf(browser);
            Assert.Equal("/index.html?external=not-verified",
                (await RoundTripAsync(browser, "microsoft", await browser.PostAsync("/api/auth/external/microsoft/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true"))))).Headers.Location!.OriginalString);
        }
        // The same tenant with the domain-owner-verified claim: accepted.
        var (verified, _) = Microsoft(f, "ms-subject-work-2", "11111111-2222-3333-4444-555555555555", "verified@fixture.example", edov: true);
        await using (verified)
        {
            using var browser = verified.Client();
            await Csrf(browser);
            Assert.Equal("/index.html?external=signed-up",
                (await RoundTripAsync(browser, "microsoft", await browser.PostAsync("/api/auth/external/microsoft/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true"))))).Headers.Location!.OriginalString);
        }
    }

    private static ConfiguredApiFactory Google(LocalBackendFixture f, string userinfo, ShiftedClock? clock = null)
    {
        var provider = new RoutedHandler(request => Task.FromResult(request.RequestUri!.AbsolutePath.EndsWith("/token", StringComparison.Ordinal)
            ? RoutedHandler.Json("""{"access_token":"isolated-access","token_type":"Bearer","expires_in":3600}""")
            : RoutedHandler.Json(userinfo)));
        return new ConfiguredApiFactory(f.DirectoryPath, new()
        {
            ["ExternalSignIn:google:ClientId"] = "isolated-client",
            ["ExternalSignIn:google:ClientSecret"] = "isolated-client-secret"
        }, services =>
        {
            services.Configure<ExternalOAuthOptions>("external-google", options => options.BackchannelHttpHandler = provider);
            if (clock is not null)
                services.Replace(ServiceDescriptor.Singleton<TimeProvider>(clock));
        });
    }

    // Microsoft with the managed-identity assertion and no secret; the stand-in token endpoint returns an ID token for this client.
    private static (ConfiguredApiFactory, RoutedHandler) Microsoft(LocalBackendFixture f, string subject, string tenant, string email, bool edov)
    {
        var claims = new Dictionary<string, object>
        {
            ["aud"] = "isolated-ms-client", ["iss"] = $"https://login.microsoftonline.com/{tenant}/v2.0", ["tid"] = tenant, ["sub"] = subject,
            ["email"] = email, ["exp"] = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds()
        };
        if (edov)
            claims["xms_edov"] = true;
        var idToken = "e30." + Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(claims))).TrimEnd('=').Replace('+', '-').Replace('/', '_') + ".unsigned";
        var provider = new RoutedHandler(request => Task.FromResult(request.RequestUri!.AbsolutePath.EndsWith("/token", StringComparison.Ordinal)
            ? RoutedHandler.Json("{\"access_token\":\"isolated-access\",\"token_type\":\"Bearer\",\"expires_in\":3600,\"id_token\":\"" + idToken + "\"}")
            // Microsoft's userinfo email is not trusted on its own: only the ID token rule decides.
            : RoutedHandler.Json("{\"sub\":\"" + subject + "\",\"email\":\"" + email + "\"}")));
        var factory = new ConfiguredApiFactory(f.DirectoryPath, new()
        {
            ["ExternalSignIn:microsoft:ClientId"] = "isolated-ms-client",
            ["ExternalSignIn:microsoft:UseManagedIdentityAssertion"] = "true"
        }, services =>
        {
            services.Configure<ExternalOAuthOptions>("external-microsoft", options => options.BackchannelHttpHandler = provider);
            services.Replace(ServiceDescriptor.Singleton<TokenCredential>(new AssertionCredential()));
        });
        return (factory, provider);
    }

    private static FormUrlEncodedContent Form(params (string Name, string Value)[] fields)
        => new(fields.Select(field => new KeyValuePair<string, string>(field.Name, field.Value)));

    // Follows the provider redirect as a browser would: the stand-in provider "approves" by returning to the callback with the state.
    private static async Task<HttpResponseMessage> RoundTripAsync(HttpClient client, string provider, HttpResponseMessage challenge)
    {
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        var authorize = challenge.Headers.Location!;
        Assert.Equal(provider == "google" ? "accounts.google.com" : "login.microsoftonline.com", authorize.Host);
        var query = HttpUtility.ParseQueryString(authorize.Query);
        Assert.Contains("email", query["scope"]!.Split(' '));
        var callback = await client.GetAsync($"/api/auth/external/callback/{provider}?code=isolated-code&state={Uri.EscapeDataString(query["state"]!)}");
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        return await client.GetAsync(callback.Headers.Location!.OriginalString);
    }

    private sealed class ShiftedClock : TimeProvider
    {
        public TimeSpan Offset { get; set; } = TimeSpan.Zero;

        public override DateTimeOffset GetUtcNow() => base.GetUtcNow() + Offset;
    }

    // Stands in for the user-assigned managed identity: answers only for the token-exchange audience.
    private sealed class AssertionCredential : TokenCredential
    {
        public override AccessToken GetToken(TokenRequestContext context, CancellationToken ct)
        {
            Assert.Equal([ExternalOAuthOptions.AssertionScope], context.Scopes);
            return new AccessToken("isolated-managed-identity-token", DateTimeOffset.UtcNow.AddMinutes(30));
        }

        public override ValueTask<AccessToken> GetTokenAsync(TokenRequestContext context, CancellationToken ct) => new(GetToken(context, ct));
    }
}
