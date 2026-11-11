// Purpose: verifies A06 contact verification, verified email replacement and configuration-gated external sign-in/linking.
// Main tests: honest unconfigured delivery, bounded codes and neutral responses; email change ownership/proof/alias release,
// taken-address and stale-write rollback, recovery rejection; external link (MFA + fresh proof), sign-in without account
// creation or email merging, MFA challenge preservation, unlink; unconfigured providers absent.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Web;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class AccountContactTests
{
    [Fact]
    public async Task Email_confirmation_is_honest_without_delivery_bounded_neutral_and_enables_sign_in_once_proven()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = "new-" + Guid.NewGuid().ToString("N") + "@fixture.example";
        await f.Services.GetRequiredService<AccountService>().RegisterAsync(new RegisterAccountDto
        { OperationId = Guid.NewGuid(), Email = email, Password = Password, DisplayName = "Pending member" }, default);
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var account = (await users.FindByEmailAsync(email))!;
        Assert.False(account.EmailConfirmed);

        var unconfigured = f.Services.GetRequiredService<ContactVerificationService>();
        var honest = await unconfigured.RequestAsync(new RequestContactVerificationDto { Email = email }, default);
        Assert.Equal("NotConfigured", honest.Delivery);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        Assert.Null(await records.ReadAsync<ContactVerification>(MfaRecoveryService.Scope(account.Id), "contactVerification:ConfirmEmail", default));

        var delivery = new CapturedContactDelivery();
        var service = ActivatorUtilities.CreateInstance<ContactVerificationService>(f.Services, delivery);
        var unknown = await service.RequestAsync(new RequestContactVerificationDto { Email = "nobody@fixture.example" }, default);
        Assert.Equal("RequestReceived", unknown.Status);
        Assert.Empty(delivery.Sent);
        await service.RequestAsync(new RequestContactVerificationDto { Email = email }, default);
        await service.RequestAsync(new RequestContactVerificationDto { Email = email }, default); // Throttled resend.
        var code = Assert.Single(delivery.Sent).Code;
        var wrong = code == "000000" ? "111111" : "000000";
        for (var attempt = 0; attempt < ContactVerificationService.MaximumAttempts; attempt++)
            Assert.Equal("verification_invalid", (await Assert.ThrowsAsync<DomainException>(() => service.ConfirmAsync(
                new ConfirmContactVerificationDto { Email = email, Code = wrong }, default))).Code);
        // The correct code no longer works once the attempt bound is reached.
        await Assert.ThrowsAsync<DomainException>(() => service.ConfirmAsync(new ConfirmContactVerificationDto { Email = email, Code = code }, default));
        Assert.False((await users.FindByEmailAsync(email))!.EmailConfirmed);

        f.Clock.Now = f.Clock.Now.AddMinutes(2);
        await service.RequestAsync(new RequestContactVerificationDto { Email = email }, default);
        var fresh = delivery.Sent[^1].Code;
        Assert.Equal("Verified", (await service.ConfirmAsync(new ConfirmContactVerificationDto { Email = email, Code = fresh }, default)).Status);
        Assert.True((await users.FindByEmailAsync(email))!.EmailConfirmed);
        Assert.Equal("Verified", (await service.ConfirmAsync(new ConfirmContactVerificationDto { Email = email, Code = fresh }, default)).Status);
        var metadata = JsonSerializer.Serialize(new
        {
            Receipts = await records.PageAsync<JsonElement>(MfaRecoveryService.Scope(account.Id), "operation", 100, null, default),
            Audit = await records.PageAsync<JsonElement>(MfaRecoveryService.Scope(account.Id), "audit", 100, null, default),
            Stored = await records.ReadAsync<JsonElement>(MfaRecoveryService.Scope(account.Id), "contactVerification:ConfirmEmail", default)
        });
        Assert.DoesNotContain("\"" + fresh + "\"", metadata, StringComparison.Ordinal);
        Assert.DoesNotContain(Password, metadata, StringComparison.Ordinal);

        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await LoginAsync(client, email);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Email_change_proves_the_new_address_keeps_the_old_one_until_then_and_releases_it_after()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var sessions = f.Services.GetRequiredService<AccountSessionService>();
        var before = (await users.FindByIdAsync(member))!;
        var oldEmail = before.Email!;
        var session = await sessions.CreateAsync(before, default);
        f.As(member, false);
        Assert.Equal("contact_delivery_unavailable", (await Assert.ThrowsAsync<DomainException>(() => f.Services.GetRequiredService<ContactVerificationService>()
            .BeginEmailChangeAsync(Begin("replacement@fixture.example"), default))).Code);
        var delivery = new CapturedContactDelivery();
        var service = ActivatorUtilities.CreateInstance<ContactVerificationService>(f.Services, delivery);
        var begin = Begin("replacement@fixture.example");
        var change = await service.BeginEmailChangeAsync(begin, default);
        Assert.Equal("Accepted", change.Delivery);
        Assert.Equal("Pending", change.Status);
        Assert.Equal(change.ChangeId, (await service.BeginEmailChangeAsync(begin, default)).ChangeId); // Exact replay, no second code.
        var sent = Assert.Single(delivery.Sent);
        Assert.Equal("replacement@fixture.example", sent.Email);
        Assert.Equal(member, (await users.FindByEmailAsync(oldEmail))?.Id);
        Assert.Null(await users.FindByEmailAsync("replacement@fixture.example"));

        var confirm = new ConfirmEmailChangeDto { OperationId = Guid.NewGuid(), ChangeId = Guid.Parse(change.ChangeId), Code = sent.Code, CurrentPassword = "wrong-isolated-fixture-password" };
        Assert.Equal("credentials_invalid", (await Assert.ThrowsAsync<DomainException>(() => service.ConfirmEmailChangeAsync(confirm, default))).Code);
        confirm.CurrentPassword = Password;
        confirm.Code = sent.Code == "000000" ? "111111" : "000000";
        Assert.Equal("verification_invalid", (await Assert.ThrowsAsync<DomainException>(() => service.ConfirmEmailChangeAsync(confirm, default))).Code);
        confirm.Code = sent.Code;
        f.AsRecovery(member);
        Assert.Equal("personal_security_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.ConfirmEmailChangeAsync(confirm, default))).Code);
        f.As(member, false);
        var result = await service.ConfirmEmailChangeAsync(confirm, default);
        Assert.Equal("Applied", result.Status);
        Assert.True(result.RequiresSignIn);
        var after = (await users.FindByEmailAsync("replacement@fixture.example"))!;
        Assert.Equal(member, after.Id);
        Assert.True(after.EmailConfirmed);
        Assert.Equal("replacement@fixture.example", after.UserName);
        Assert.Null(await users.FindByEmailAsync(oldEmail));
        Assert.False(await sessions.ValidAsync(member, session.Id, before.SecurityStamp!, default));
        Assert.Equal("AlreadyApplied", (await service.ConfirmEmailChangeAsync(confirm, default)).Status);
        // The released old address can be registered by someone else.
        await f.Services.GetRequiredService<AccountService>().RegisterAsync(new RegisterAccountDto
        { OperationId = Guid.NewGuid(), Email = oldEmail, Password = Password, DisplayName = "Another person" }, default);
        Assert.NotEqual(member, (await users.FindByEmailAsync(oldEmail))!.Id);
    }

    [Fact]
    public async Task A_taken_address_or_a_concurrent_account_change_leaves_aliases_and_account_unchanged()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var first = await f.CreateVerifiedMemberAsync();
        var second = await f.CreateVerifiedMemberAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var taken = (await users.FindByIdAsync(first))!.Email!;
        var original = (await users.FindByIdAsync(second))!;
        f.As(second, false);
        var delivery = new CapturedContactDelivery();
        var service = ActivatorUtilities.CreateInstance<ContactVerificationService>(f.Services, delivery);
        var change = await service.BeginEmailChangeAsync(Begin(taken), default);
        Assert.Equal("email_unavailable", (await Assert.ThrowsAsync<DomainException>(() => service.ConfirmEmailChangeAsync(new ConfirmEmailChangeDto
        { OperationId = Guid.NewGuid(), ChangeId = Guid.Parse(change.ChangeId), Code = delivery.Sent[^1].Code, CurrentPassword = Password }, default))).Code);
        Assert.Equal(first, (await users.FindByEmailAsync(taken))!.Id);
        Assert.Equal(original.Email, (await users.FindByIdAsync(second))!.Email);

        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var intercepted = new CommitInterceptionRecords(records, async () =>
        {
            var concurrent = (await users.FindByIdAsync(second))!;
            concurrent.DisplayName = "Independent concurrent update";
            Assert.True((await users.UpdateAsync(concurrent)).Succeeded);
        });
        var free = await service.BeginEmailChangeAsync(Begin("free-address@fixture.example"), default);
        var racing = ActivatorUtilities.CreateInstance<ContactVerificationService>(f.Services, delivery, intercepted);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => racing.ConfirmEmailChangeAsync(new ConfirmEmailChangeDto
        { OperationId = Guid.NewGuid(), ChangeId = Guid.Parse(free.ChangeId), Code = delivery.Sent[^1].Code, CurrentPassword = Password }, default))).Code);
        var store = (CosmosIdentityStore)f.Services.GetRequiredService<IUserStore<ParishUser>>();
        Assert.Null(await store.FindAliasOwnerAsync("email", users.NormalizeEmail("free-address@fixture.example")!, default));
        Assert.Equal(original.Email, (await users.FindByIdAsync(second))!.Email);
        Assert.Equal(second, (await users.FindByEmailAsync(original.Email!))!.Id);
    }

    [Fact]
    public async Task Unconfigured_external_providers_are_absent_and_their_routes_do_not_exist()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        var capabilities = await Read<AuthenticationCapabilitiesDto>(await client.GetAsync("/api/auth/capabilities"));
        Assert.All(capabilities.ExternalProviders, provider => Assert.False(provider.Available));
        await Csrf(client);
        Assert.Equal("external_provider_unavailable", await Title(await client.PostAsync("/api/auth/external/google/sign-in", null)));
    }

    [Fact]
    public async Task Unlinked_external_subjects_and_non_mfa_accounts_cannot_sign_in_or_link()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = Provider(f, "provider-subject-unlinked");
        using var anonymous = factory.Client();
        var capabilities = await Read<AuthenticationCapabilitiesDto>(await anonymous.GetAsync("/api/auth/capabilities"));
        Assert.True(capabilities.ExternalProviders.Single(p => p.Provider == "google").Available);
        Assert.False(capabilities.ExternalProviders.Single(p => p.Provider == "microsoft").Available);
        Assert.DoesNotContain("isolated-client-secret", JsonSerializer.Serialize(capabilities), StringComparison.Ordinal);
        // An unlinked subject (even with a matching provider email) is refused and creates nothing.
        await Csrf(anonymous);
        var refused = await RoundTripAsync(anonymous, await anonymous.PostAsync("/api/auth/external/google/sign-in", null));
        Assert.Equal(HttpStatusCode.Unauthorized, refused.StatusCode);
        Assert.Equal("external_login_not_linked", await Title(refused));
        Assert.Empty((await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(f.Other))!.ExternalLogins);
        var member = await f.CreateVerifiedMemberAsync();
        var memberName = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(member))!.UserName!;
        using var plain = factory.Client();
        await LoginAsync(plain, memberName);
        Assert.Equal("mfa_required", await Title(await plain.PostAsJsonAsync("/api/auth/external/google/link", new LinkExternalLoginDto { CurrentPassword = Password })));
    }

    [Fact]
    public async Task External_login_links_with_mfa_and_fresh_proof_and_sign_in_keeps_the_authenticator_step()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        const string subject = "provider-subject-1";
        await using var factory = Provider(f, subject);
        using var owner = factory.Client();
        await LoginAsync(owner, "other@fixture.example");
        Assert.Equal("credentials_invalid", await Title(await owner.PostAsJsonAsync("/api/auth/external/google/link", new LinkExternalLoginDto { CurrentPassword = Password })));
        var linked = await RoundTripAsync(owner, await owner.PostAsJsonAsync("/api/auth/external/google/link",
            new LinkExternalLoginDto { CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() }));
        Assert.Equal(HttpStatusCode.OK, linked.StatusCode);
        var stored = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(f.Other))!;
        Assert.Equal("google", Assert.Single(stored.ExternalLogins).Provider);
        Assert.DoesNotContain(subject, JsonSerializer.Serialize(stored), StringComparison.Ordinal);
        Assert.Equal("google", Assert.Single(await Read<List<ExternalLoginDto>>(await owner.GetAsync("/api/auth/external"))).Provider);

        using var browser = factory.Client();
        await Csrf(browser);
        var challenged = await RoundTripAsync(browser, await browser.PostAsync("/api/auth/external/google/sign-in", null));
        Assert.Equal(HttpStatusCode.Accepted, challenged.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.GetAsync("/api/auth/me")).StatusCode);
        await CompleteMfaAsync(browser, (await challenged.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challenge"));
        Assert.Equal(f.Other, (await Read<AccountDto>(await browser.GetAsync("/api/auth/me"))).Id);

        // A second host (fresh per-host rate limit) over the same isolated data: unlink needs proof and the subject stops working.
        await using var next = Provider(f, subject);
        using var again = next.Client();
        await LoginAsync(again, "other@fixture.example");
        var unlink = new UnlinkExternalLoginDto { OperationId = Guid.NewGuid(), CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() };
        Assert.Equal("Applied", (await Read<AccountSecurityChangeDto>(await again.PostAsJsonAsync("/api/auth/external/google/unlink", unlink))).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await again.GetAsync("/api/auth/me")).StatusCode);
        Assert.Empty((await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(f.Other))!.ExternalLogins);
        using var after = next.Client();
        await Csrf(after);
        Assert.Equal(HttpStatusCode.Unauthorized, (await RoundTripAsync(after, await after.PostAsync("/api/auth/external/google/sign-in", null))).StatusCode);
    }

    private static ConfiguredApiFactory Provider(LocalBackendFixture f, string subject)
    {
        var provider = new RoutedHandler(request => Task.FromResult(request.RequestUri!.AbsolutePath.EndsWith("/token", StringComparison.Ordinal)
            ? RoutedHandler.Json("""{"access_token":"isolated-access","token_type":"Bearer","expires_in":3600}""")
            // A claimed email is deliberately present and must be ignored for matching.
            : RoutedHandler.Json("{\"sub\":\"" + subject + "\",\"email\":\"other@fixture.example\",\"email_verified\":true}")));
        return new ConfiguredApiFactory(f.DirectoryPath, new()
        {
            ["ExternalSignIn:google:ClientId"] = "isolated-client",
            ["ExternalSignIn:google:ClientSecret"] = "isolated-client-secret"
        }, services => services.Configure<OAuthOptions>("external-google", options => options.BackchannelHttpHandler = provider));
    }

    // Follows the provider redirect as a browser would: the fake provider "approves" by returning to the callback with the state.
    private static async Task<HttpResponseMessage> RoundTripAsync(HttpClient client, HttpResponseMessage challenge)
    {
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        var authorize = challenge.Headers.Location!;
        Assert.Equal("accounts.google.com", authorize.Host);
        var query = HttpUtility.ParseQueryString(authorize.Query);
        Assert.Equal("isolated-client", query["client_id"]);
        var callback = await client.GetAsync($"/api/auth/external/callback/google?code=isolated-code&state={Uri.EscapeDataString(query["state"]!)}");
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        return await client.GetAsync(callback.Headers.Location!.OriginalString);
    }

    private static BeginEmailChangeDto Begin(string email) => new()
    { OperationId = Guid.NewGuid(), NewEmail = email, CurrentPassword = Password };
}
