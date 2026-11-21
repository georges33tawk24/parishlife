// Purpose: HTTP regressions for the hardening run's application-security fixes (hardening/reports/03-security.md), each attempting the
// attack or misuse and checking it is refused.
// Main tests: security headers, HSTS and no Server header; OpenAPI off unless enabled; a spoofed X-Forwarded-For cannot dodge the sign-in
// rate limit; the capability report follows configuration; announcement markup is sanitized when saved; the 13-or-older confirmation at
// sign-up; forgotten-password reset by emailed code (neutral answers, attempt limit, one use, MFA still required, every session ended,
// no sign-in); own data copy and account closure (fresh proof, sessions end, identity anonymized, address reusable); email lookups are
// case-insensitive but compatibility look-alikes do not reach another account; an authenticator code signs in once; security events
// are logged with the account id and no secret; no CORS allow header for another origin; real names (O'Brien, José, محمد, 李) are
// stored exactly.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Accounts;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Operations;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class SecurityHardeningHttpTests
{
    [Fact]
    public async Task Responses_carry_security_headers_and_hosting_options_hide_the_server()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        var response = await client.GetAsync("/api/auth/csrf");
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("same-origin", response.Headers.GetValues("Cross-Origin-Opener-Policy").Single());
        Assert.Contains("camera=()", response.Headers.GetValues("Permissions-Policy").Single(), StringComparison.Ordinal);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.False(response.Headers.Contains("Server"));
        // No CORS: another site's origin gets no allow header, so cookies never go cross-origin with a readable answer.
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/auth/me");
        preflight.Headers.Add("Origin", "https://evil.example");
        preflight.Headers.Add("Access-Control-Request-Method", "GET");
        Assert.False((await client.SendAsync(preflight)).Headers.Contains("Access-Control-Allow-Origin"));
        Assert.False(factory.Services.GetRequiredService<IOptions<KestrelServerOptions>>().Value.AddServerHeader);
        var hsts = factory.Services.GetRequiredService<IOptions<HstsOptions>>().Value;
        Assert.Equal(TimeSpan.FromDays(365), hsts.MaxAge);
        Assert.True(hsts.IncludeSubDomains);
        Assert.False(hsts.Preload);
    }

    [Fact]
    public async Task OpenApi_document_is_not_served_when_disabled_and_never_anonymously()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using (var development = new LocalApiFactory(f.DirectoryPath))
        {
            using var anonymous = development.Client();
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/openapi/v1.json")).StatusCode);
        }
        await using var production = new ConfiguredApiFactory(f.DirectoryPath, new() { ["OpenApi:Enabled"] = "false" }, _ => { });
        using var client = production.Client();
        await LoginAsync(client, "other@fixture.example");
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/openapi/v1.json")).StatusCode);
    }

    [Fact]
    public async Task Spoofed_forwarded_addresses_share_the_real_clients_sign_in_limit()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["ForwardedHeaders:Enabled"] = "true" }, _ => { });
        using var client = factory.Client();
        // The front end appends the address it saw; whatever the client wrote to its left changes every time.
        async Task<HttpStatusCode> LoginFrom(string forwardedFor)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { username = "x", password = "y" }) };
            request.Headers.Add("X-Forwarded-For", forwardedFor);
            return (await client.SendAsync(request)).StatusCode;
        }
        for (var i = 0; i < 20; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, await LoginFrom($"198.51.100.{i}, 203.0.113.7"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await LoginFrom("198.51.100.99, 203.0.113.7"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await LoginFrom("10.0.0.1, 192.0.2.1, 203.0.113.7"));
        // Another real client (another right-most address) has its own budget.
        Assert.NotEqual(HttpStatusCode.TooManyRequests, await LoginFrom("203.0.113.7, 203.0.113.8"));
    }

    [Fact]
    public async Task An_authenticator_code_signs_in_once_and_security_events_are_logged_without_secrets()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var logs = new CapturedLogs();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new(), services => services.AddSingleton<ILoggerProvider>(logs));
        async Task<(HttpStatusCode Status, string Code)> SignInAsync(HttpClient client, string? code = null)
        {
            await Csrf(client);
            var challenge = (await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username = "other@fixture.example", password = Password })))
                .GetProperty("challenge");
            code ??= TestAuthenticator.Code();
            var response = await client.PostAsJsonAsync("/api/auth/login/mfa", new
            {
                accountId = challenge.GetProperty("accountId").GetString(), challenge = challenge.GetProperty("challenge").GetString(), code
            });
            return (response.StatusCode, code);
        }
        using var first = factory.Client();
        var (status, used) = await SignInAsync(first);
        Assert.Equal(HttpStatusCode.OK, status);
        using var replay = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await SignInAsync(replay, used)).Status);

        await Csrf(replay);
        await replay.PostAsJsonAsync("/api/auth/login", new { username = "other@fixture.example", password = "not-the-password-at-all" });
        var events = logs.Lines.Where(line => line.Contains("Security event", StringComparison.Ordinal)).ToArray();
        Assert.Contains(events, line => line.Contains("security.mfa_failed", StringComparison.Ordinal) && line.Contains(f.Other, StringComparison.Ordinal));
        Assert.Contains(events, line => line.Contains("security.sign_in_failed", StringComparison.Ordinal) && line.Contains("password", StringComparison.Ordinal));
        Assert.DoesNotContain(logs.Lines, line => line.Contains("not-the-password-at-all", StringComparison.Ordinal)
            || line.Contains(Password, StringComparison.Ordinal) || line.Contains("other@fixture.example", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Capability_report_follows_the_configured_providers_and_bot_check()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using (var plain = new LocalApiFactory(f.DirectoryPath))
        {
            using var plainScope = plain.Services.CreateScope();
            var list = plainScope.ServiceProvider.GetRequiredService<CapabilityService>().List();
            Assert.False(list.Single(c => c.Name == "External sign-in").Available);
            Assert.False(list.Single(c => c.Name == "Bot check").Available);
        }
        await using var configured = new ConfiguredApiFactory(f.DirectoryPath, new()
        {
            ["ExternalSignIn:google:ClientId"] = "isolated-client",
            ["ExternalSignIn:google:ClientSecret"] = "isolated-secret",
            ["Turnstile:SiteKey"] = "isolated-site-key",
            ["Turnstile:SecretKey"] = "isolated-turnstile-secret"
        }, _ => { });
        using var scope = configured.Services.CreateScope();
        var capabilities = scope.ServiceProvider.GetRequiredService<CapabilityService>().List();
        var external = capabilities.Single(c => c.Name == "External sign-in");
        Assert.True(external.Available);
        Assert.Contains("google", external.Behaviour, StringComparison.Ordinal);
        Assert.DoesNotContain("microsoft", external.Behaviour, StringComparison.Ordinal);
        Assert.True(capabilities.Single(c => c.Name == "Bot check").Available);
        Assert.DoesNotContain(capabilities, c => c.Behaviour.Contains("isolated-secret", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Announcement_markup_is_sanitized_when_saved()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var writer = await s.Fixture.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(writer), Allows = [Permissions.CommunicationsManage], StartsAt = f.Clock.Now
        }, default);
        f.As(writer);
        var saved = await f.Services.GetRequiredService<CommunicationsService>().SaveAnnouncementAsync(s.Parish, null, new SaveAnnouncementDto
        {
            OperationId = Guid.NewGuid(), Visibility = "Public", Title = "Feast", Language = "en",
            Body = "<p onclick=\"steal()\">Mass at <b>10</b></p><img src=x onerror=alert(1)><script>alert(2)</script><a href=\"javascript:alert(3)\">x</a>"
        }, default);
        var stored = (await f.Services.GetRequiredService<IRecordTransactions>()
            .ReadAsync<Announcement>(new RecordScope { Area = RecordArea.Parish, OwnerId = s.Parish }, "announcement:" + saved.Id, default))!.Value;
        Assert.Equal("<p>Mass at <b>10</b></p>alert(2)x", stored.Body);
    }

    [Fact]
    public async Task Sign_up_requires_the_13_or_older_confirmation()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new()
        {
            ["ExternalSignIn:google:ClientId"] = "isolated-client",
            ["ExternalSignIn:google:ClientSecret"] = "isolated-secret"
        }, _ => { });
        using var client = factory.Client();
        await Csrf(client);
        var email = "young-" + Guid.NewGuid().ToString("N") + "@fixture.example";
        var refused = await client.PostAsJsonAsync("/api/auth/register", new { operationId = Guid.NewGuid(), email, password = Password, displayName = "New" });
        Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
        Assert.Equal("age_confirmation_required", await Title(refused));
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        Assert.Null(await users.FindByEmailAsync(email));
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/register",
            new { operationId = Guid.NewGuid(), email, password = Password, displayName = "New", ageConfirmed = true })).StatusCode);
        Assert.NotNull(await users.FindByEmailAsync(email));
        // Provider sign-up: refused before the provider is contacted.
        var portal = await client.PostAsync("/api/auth/external/google/sign-up", Form(("returnTo", "portal")));
        Assert.Equal("/index.html?external=age-required", portal.Headers.Location!.OriginalString);
        Assert.Equal("age_confirmation_required", await Title(await client.PostAsync("/api/auth/external/google/sign-up", Form(("returnTo", "json")))));
        var allowed = await client.PostAsync("/api/auth/external/google/sign-up", Form(("returnTo", "portal"), ("ageConfirmed", "true")));
        Assert.Equal("accounts.google.com", allowed.Headers.Location!.Host);
    }

    [Fact]
    public async Task Password_reset_by_emailed_code_is_neutral_bounded_single_use_and_ends_every_session()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await ConfirmEmailAsync(f, await f.CreateVerifiedMemberAsync());
        var delivery = new CapturedContactDelivery();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new(), services => services.AddScoped<IContactCodeDelivery>(_ => delivery));
        using var signedIn = factory.Client();
        await LoginAsync(signedIn, member);
        using var client = factory.Client();
        await Csrf(client);

        var unknown = await client.PostAsJsonAsync("/api/auth/password-reset", new { email = "nobody@fixture.example" });
        var known = await client.PostAsJsonAsync("/api/auth/password-reset", new { email = member });
        Assert.Equal(HttpStatusCode.Accepted, unknown.StatusCode);
        Assert.Equal(await unknown.Content.ReadAsStringAsync(), await known.Content.ReadAsStringAsync());
        await client.PostAsJsonAsync("/api/auth/password-reset", new { email = member }); // within a minute: no second code
        var sent = Assert.Single(delivery.Sent);
        Assert.Equal(("ResetPassword", member), (sent.Purpose, sent.Email));
        Assert.Matches("^[0-9]{8}$", sent.Code);
        // The code is stored only as a hash and never appears in the receipt or audit.
        Assert.DoesNotContain(sent.Code, string.Join("\n", Directory.EnumerateFiles(f.DirectoryPath, "*", SearchOption.AllDirectories)
            .Where(path => !path.Contains("keyring", StringComparison.Ordinal)).Select(File.ReadAllText)), StringComparison.Ordinal);

        const string newPassword = "a-new-isolated-fixture-password";
        object Confirm(string code) => new { email = member, code, newPassword };
        var wrong = sent.Code == "00000000" ? "11111111" : "00000000";
        Assert.Equal("verification_invalid", await Title(await client.PostAsJsonAsync("/api/auth/password-reset/confirm", Confirm(wrong))));
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/password-reset/confirm", Confirm(sent.Code))).StatusCode);
        // Not signed in by the reset; the old session ended; the code works once; old password gone, new one signs in.
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await signedIn.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal("verification_invalid", await Title(await client.PostAsJsonAsync("/api/auth/password-reset/confirm", Confirm(sent.Code))));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { username = member, password = Password })).StatusCode);
        await LoginAsync(client, member, newPassword);

        // Five wrong attempts use a code up, even for the right code afterwards (the completed code allows a new request at once).
        using var other = factory.Client();
        await Csrf(other);
        await other.PostAsJsonAsync("/api/auth/password-reset", new { email = member });
        var second = delivery.Sent[^1].Code;
        var miss = second == "00000000" ? "11111111" : "00000000";
        for (var i = 0; i < 5; i++)
            await other.PostAsJsonAsync("/api/auth/password-reset/confirm", Confirm(miss));
        Assert.Equal("verification_invalid", await Title(await other.PostAsJsonAsync("/api/auth/password-reset/confirm", new { email = member, code = second, newPassword = "yet-another-isolated-password" })));
    }

    [Fact]
    public async Task Password_reset_of_an_mfa_account_still_needs_the_authenticator_and_sign_in_still_asks_for_it()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = await ConfirmEmailAsync(f, f.Other);
        var delivery = new CapturedContactDelivery();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new(), services => services.AddScoped<IContactCodeDelivery>(_ => delivery));
        using var client = factory.Client();
        await Csrf(client);
        await client.PostAsJsonAsync("/api/auth/password-reset", new { email });
        var code = Assert.Single(delivery.Sent).Code;
        const string newPassword = "a-new-isolated-fixture-password";
        Assert.Equal("verification_invalid", await Title(await client.PostAsJsonAsync("/api/auth/password-reset/confirm", new { email, code, newPassword })));
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/password-reset/confirm",
            new { email, code, newPassword, currentCode = TestAuthenticator.Code() })).StatusCode);
        await Csrf(client);
        var login = await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = newPassword });
        Assert.Equal(HttpStatusCode.Accepted, login.StatusCode); // the authenticator step is still required
        Assert.True((await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("requiresTwoFactor").GetBoolean());
    }

    [Fact]
    public async Task Own_data_copy_and_account_closure_need_fresh_proof_end_sessions_and_anonymize_the_identity()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = await ConfirmEmailAsync(f, await f.CreateVerifiedMemberAsync());
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var other = factory.Client();
        await LoginAsync(other, email);
        using var client = factory.Client();
        await LoginAsync(client, email);

        Assert.True((await client.PostAsJsonAsync("/api/me/personal-workspace", new { operationId = Guid.NewGuid(), kind = "Note", body = "A private note" })).IsSuccessStatusCode);
        var copy = await client.GetAsync("/api/auth/account/data");
        Assert.Equal("attachment", copy.Content.Headers.ContentDisposition?.DispositionType);
        var data = await copy.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(email, data.GetProperty("account").GetProperty("email").GetString());
        Assert.Contains("A private note", data.GetProperty("personalItems").GetRawText(), StringComparison.Ordinal);
        Assert.DoesNotContain("passwordHash", await copy.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        object Close(string? password, string confirmation = "CLOSE") => new { operationId = Guid.NewGuid(), currentPassword = password, confirmation };
        Assert.Equal("closure_confirmation_required", await Title(await client.PostAsJsonAsync("/api/auth/account/close", Close(Password, "yes"))));
        Assert.Equal("credentials_invalid", await Title(await client.PostAsJsonAsync("/api/auth/account/close", Close("wrong-password-wrong-password"))));
        var closed = await Read<AccountClosureDto>(await client.PostAsJsonAsync("/api/auth/account/close", Close(Password)));
        Assert.Equal("Closed", closed.Status);
        Assert.NotEmpty(closed.Kept);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.GetAsync("/api/auth/me")).StatusCode);
        await Csrf(client);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = Password })).StatusCode);
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var tombstone = (await users.FindByIdAsync(data.GetProperty("account").GetProperty("id").GetString()!))!;
        Assert.Equal((false, null, null, null, "Closed account"), (tombstone.Active, tombstone.Email, tombstone.UserName, tombstone.PasswordHash, tombstone.DisplayName));
        Assert.NotNull(tombstone.ClosedAt);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var scope = new RecordScope { Area = RecordArea.Account, OwnerId = tombstone.Id };
        Assert.Empty(await records.CollectAsync<object>(scope, "personalWorkspaceItem", default));
        Assert.Empty(await records.CollectAsync<object>(scope, "personalWorkspaceRevision", default));
        Assert.Null(await records.ReadAsync<object>(scope, "accountProfile", default));
        // The address is free again for a new account.
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/register",
            new { operationId = Guid.NewGuid(), email, password = Password, displayName = "New", ageConfirmed = true })).StatusCode);
        Assert.NotEqual(tombstone.Id, (await users.FindByEmailAsync(email))!.Id);
    }

    [Fact]
    public async Task Closing_an_mfa_account_needs_the_authenticator_and_operators_cannot_close_themselves()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await LoginAsync(client, "other@fixture.example");
        Assert.Equal("credentials_invalid", await Title(await client.PostAsJsonAsync("/api/auth/account/close",
            new { operationId = Guid.NewGuid(), currentPassword = Password, confirmation = "CLOSE" })));
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/account/close",
            new { operationId = Guid.NewGuid(), currentPassword = Password, currentCode = TestAuthenticator.Code(), confirmation = "CLOSE" })).StatusCode);

        using var operatorClient = factory.Client();
        await LoginAsync(operatorClient, "colinsleiman");
        Assert.Equal("operator_account_protected", await Title(await operatorClient.PostAsJsonAsync("/api/auth/account/close",
            new { operationId = Guid.NewGuid(), currentPassword = Password, currentCode = TestAuthenticator.Code(), confirmation = "CLOSE" })));
    }

    [Fact]
    public async Task Real_names_with_apostrophes_accents_and_other_scripts_are_kept_exactly()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await Csrf(client);
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        foreach (var name in new[] { "Seán O'Brien", "Jean-Luc", "José", "محمد", "李", "Robert'); DROP TABLE people;--" })
        {
            var email = "name-" + Guid.NewGuid().ToString("N") + "@fixture.example";
            Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/register",
                new { operationId = Guid.NewGuid(), email, password = Password, displayName = name, ageConfirmed = true })).StatusCode);
            Assert.Equal(name, (await users.FindByEmailAsync(email))!.DisplayName);
        }
    }

    [Fact]
    public async Task Email_lookup_ignores_case_but_compatibility_lookalikes_do_not_reach_the_account()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        Assert.Equal(f.Other, (await users.FindByEmailAsync("  OTHER@Fixture.Example ".Trim()))!.Id);
        Assert.Null(await users.FindByEmailAsync("ｏｔｈｅｒ@fixture.example")); // full-width letters
        Assert.Null(await users.FindByEmailAsync("othеr@fixture.example")); // Cyrillic е
        var normalized = users.NormalizeEmail("Other@Fixture.Example")!;
        Assert.Equal(normalized, users.NormalizeEmail(normalized)); // idempotent
    }

    private static async Task<string> ConfirmEmailAsync(LocalBackendFixture f, string accountId)
    {
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var user = (await users.FindByIdAsync(accountId))!;
        user.EmailConfirmed = true; // controlled test setup: the confirmation flow itself is covered by AccountContactTests
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        return user.Email!;
    }

    private sealed class CapturedLogs : ILoggerProvider
    {
        public System.Collections.Concurrent.ConcurrentQueue<string> Lines { get; } = new();

        public ILogger CreateLogger(string categoryName) => new Logger(this);

        public void Dispose()
        {
        }

        private sealed class Logger(CapturedLogs owner) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
                => owner.Lines.Enqueue(formatter(state, exception));
        }
    }

    private static FormUrlEncodedContent Form(params (string Name, string Value)[] fields)
        => new(fields.Select(field => new KeyValuePair<string, string>(field.Name, field.Value)));
}
