// Purpose: HTTP regressions for the hardening run's security sweep 1 (hardening/reports/03-security.md, "Sweep 1").
// Main tests: account closure is refused while the account owns a parish, holds parish access or leads a ministry, and succeeds once access ends; an
// authenticator code spent on a password reset cannot sign in, and one spent on a sign-in cannot reset a password; a withdrawn public
// announcement leaves the server's public cache at once; a published parish page gets its own encoded head, an unknown or unverified one
// a 404, a verified one with no published profile the plain page, and the generated sitemap lists only published parishes; the page policy names no Google host; the API and tracking links
// carry X-Robots-Tag noindex; sign-up records the accepted terms version and time.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Extensions;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Publishing;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Accounts;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class SecuritySweepTests
{
    private static object Close() => new { operationId = Guid.NewGuid(), currentPassword = Password, currentCode = TestAuthenticator.Code(), confirmation = "CLOSE" };

    [Fact]
    public async Task Closure_is_refused_while_the_account_owns_a_parish_or_holds_access_and_allowed_once_access_ends()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await IndependentParishScenario.CreateAsync(f); // f.Other owns the parish
        var staff = await f.CreateVerifiedStaffAsync();
        f.As(f.Other);
        var parishes = f.Services.GetRequiredService<ParishService>();
        await parishes.GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(staff), Allows = [Permissions.PeopleRead], StartsAt = f.Clock.Now
        }, default);
        var staffEmail = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(staff))!.Email!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);

        using var owner = factory.Client();
        await LoginAsync(owner, "other@fixture.example");
        var refused = await owner.PostAsJsonAsync("/api/auth/account/close", Close());
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        var problem = await refused.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("closure_responsibilities_held", problem.GetProperty("title").GetString());
        Assert.Contains("parish ownership", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/auth/me")).StatusCode); // nothing was closed

        using var member = factory.Client();
        await LoginAsync(member, staffEmail);
        var held = await member.PostAsJsonAsync("/api/auth/account/close", Close());
        problem = await held.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("closure_responsibilities_held", problem.GetProperty("title").GetString());
        Assert.Contains("parish access", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);

        f.As(f.Other);
        await parishes.RevokeAsync(s.Parish, new RevokeAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Parishes.GetAsync(s.Parish, default))!.Version, AccountId = Guid.Parse(staff), Reason = "Isolated hand-over"
        }, default);
        Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/auth/account/close", Close())).StatusCode);
    }

    // Audit N4: a ministry leader appointment gives leader rights without a grant, so it must be handed over before closure too.
    [Fact]
    public async Task Closure_is_refused_while_the_account_leads_a_ministry()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var group = await s.MinistryAsync();
        var leader = await s.LinkedApplicantAsync(true); // leaders need MFA
        await s.ApplicationActionAsync(group.Id, (await s.ApplyAsync(group.Id, leader.AccountId)).Id, "approve");
        s.Use();
        await f.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, group.Id, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, group.Id, default)).Version,
            AccountId = Guid.Parse(leader.AccountId), Role = "Leader", StartsAt = f.Clock.Now, EvidenceReference = "Isolated leader appointment"
        }, default);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await LoginAsync(client, (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(leader.AccountId))!.Email!);

        var refused = await client.PostAsJsonAsync("/api/auth/account/close", Close());
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        var problem = await refused.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("closure_responsibilities_held", problem.GetProperty("title").GetString());
        Assert.Contains("ministry leader", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task An_authenticator_code_spent_on_a_reset_cannot_sign_in_and_one_spent_on_a_sign_in_cannot_reset()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var account = (await users.FindByIdAsync(f.Other))!;
        account.EmailConfirmed = true; // controlled setup; the confirmation flow is covered by AccountContactTests
        Assert.True((await users.UpdateAsync(account)).Succeeded);
        var email = account.Email!;
        var delivery = new CapturedContactDelivery();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new(), services => services.AddScoped<IContactCodeDelivery>(_ => delivery));
        using var client = factory.Client();
        await Csrf(client);
        const string newPassword = "a-new-isolated-fixture-password";

        // Reset with the current code, then try to sign in with that same code.
        await client.PostAsJsonAsync("/api/auth/password-reset", new { email });
        var totp = TestAuthenticator.Code();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/password-reset/confirm",
            new { email, code = delivery.Sent[^1].Code, newPassword, currentCode = totp })).StatusCode);
        await Csrf(client);
        var challenge = (await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = newPassword }))).GetProperty("challenge");
        var accountId = challenge.GetProperty("accountId").GetString();
        var challengeId = challenge.GetProperty("challenge").GetString();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login/mfa", new { accountId, challenge = challengeId, code = totp })).StatusCode);

        // Sign in with the next step's code (Identity accepts it), then try to reset with that same code.
        var next = TestAuthenticator.Code(step: 1);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login/mfa", new { accountId, challenge = challengeId, code = next })).StatusCode);
        await Csrf(client);
        await client.PostAsJsonAsync("/api/auth/password-reset", new { email });
        Assert.Equal("verification_invalid", await Title(await client.PostAsJsonAsync("/api/auth/password-reset/confirm",
            new { email, code = delivery.Sent[^1].Code, newPassword = "yet-another-isolated-password", currentCode = next })));
    }

    [Fact]
    public async Task A_withdrawn_public_announcement_disappears_from_the_cached_public_read_at_once()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var publisher = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(publisher), Allows = [Permissions.CommunicationsManage, Permissions.PublishingManage], StartsAt = f.Clock.Now
        }, default);
        var email = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(publisher))!.Email!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var staff = factory.Client();
        await LoginAsync(staff, email);
        var draft = await Read<JsonElement>(await staff.PostAsJsonAsync($"/api/parishes/{s.Parish}/announcements",
            new { operationId = Guid.NewGuid(), visibility = "Public", title = "Visible for now", body = "Details", language = "en" }));
        var id = draft.GetProperty("id").GetString();
        async Task ActAsync(string action)
        {
            var rows = await Read<JsonElement>(await staff.GetAsync($"/api/parishes/{s.Parish}/announcements"));
            var version = rows.EnumerateArray().Single(r => r.GetProperty("value").GetProperty("id").GetString() == id).GetProperty("version").GetString();
            await Read<JsonElement>(await staff.PostAsJsonAsync($"/api/parishes/{s.Parish}/announcements/{id}/actions",
                new { operationId = Guid.NewGuid(), version, action, reason = "Isolated test" }));
        }
        await ActAsync("publish");

        using var visitor = factory.Client();
        var path = $"/api/public/parishes/{s.Parish}/announcements";
        Assert.Contains("Visible for now", await visitor.GetStringAsync(path), StringComparison.Ordinal);
        var cached = await visitor.GetAsync(path);
        Assert.Equal("public, max-age=60", cached.Headers.CacheControl!.ToString());
        Assert.Contains("Visible for now", await cached.Content.ReadAsStringAsync(), StringComparison.Ordinal);

        await ActAsync("withdraw");
        Assert.DoesNotContain("Visible for now", await visitor.GetStringAsync(path), StringComparison.Ordinal);
    }

    [Fact]
    public async Task Parish_pages_get_their_own_encoded_head_unknown_ones_a_404_and_the_sitemap_lists_only_published_parishes()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PublishingManage]));
        f.AsAppointment(f.Other, appointment.Id);
        var profiles = f.Services.GetRequiredService<ParishProfileService>();
        var saved = await profiles.SaveAsync(staff.Parish, new SaveParishProfileDto
        {
            OperationId = Guid.NewGuid(), Profile = new ParishProfileContentDto { Rite = "<b>Maronite</b> & \"Syriac\"", MassTimes = "Sunday 10:00 $_ $' $&", Address = "Fixture street" }
        }, default);
        f.As(f.FirstAdmin);
        var pending = (await f.Services.GetRequiredService<ParishService>().RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(), Name = "Pending parish", Locality = "Fixture locality", Contact = "fixture.example"
        }, default)).Id;
        var web = Path.Combine(f.DirectoryPath, "web");
        Directory.CreateDirectory(web);
        await File.WriteAllTextAsync(Path.Combine(web, "index.html"), "<!doctype html><html><head><title>Sign in</title></head><body></body></html>");
        await File.WriteAllTextAsync(Path.Combine(web, "public.html"), "<!doctype html><html><head><meta name=\"description\" content=\"Find parishes\">"
            + "<meta property=\"og:title\" content=\"ParishLife\"><meta property=\"og:description\" content=\"Find parishes\"><title>ParishLife · Find your parish</title>"
            + "<link rel=\"canonical\" href=\"https://parish-life.org/public.html\"></head><body></body></html>");
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["webroot"] = web }, _ => { });
        using var client = factory.Client();
        var page = "/public.html?parish=" + staff.Parish;

        // Verified and listed, profile not published yet: the plain page with 200 (the directory shows it), no parish head.
        var unpublished = await client.GetAsync(page);
        Assert.Equal(HttpStatusCode.OK, unpublished.StatusCode);
        var plain = await unpublished.Content.ReadAsStringAsync();
        Assert.Contains("Find your parish", plain, StringComparison.Ordinal);
        Assert.DoesNotContain("rel=\"canonical\"", plain, StringComparison.Ordinal);
        Assert.DoesNotContain(staff.Parish, await client.GetStringAsync("/sitemap.xml"), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/public.html?parish=" + pending)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/public.html?parish=" + Guid.NewGuid())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/public.html?parish=not-a-guid")).StatusCode);

        f.AsAppointment(f.Other, appointment.Id);
        await profiles.ActAsync(staff.Parish, new ParishProfileActionDto { OperationId = Guid.NewGuid(), Version = saved.Version, Action = "publish" }, default);
        var published = await client.GetAsync(page);
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        var html = await published.Content.ReadAsStringAsync();
        Assert.Contains("<title>Isolated parish &#183; ParishLife</title>", html, StringComparison.Ordinal);
        Assert.Contains($"<link rel=\"canonical\" href=\"https://localhost/public.html?parish={staff.Parish}\">", html, StringComparison.Ordinal);
        Assert.DoesNotContain("parish-life.org/public.html\"", html, StringComparison.Ordinal); // the directory's static canonical is replaced, never doubled
        Assert.Contains("&lt;b&gt;Maronite&lt;/b&gt; &amp; &quot;Syriac&quot;", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<b>Maronite", html, StringComparison.Ordinal);
        Assert.Contains("Mass times: Sunday 10:00 $_ $&#39; $&amp;\">", html, StringComparison.Ordinal); // "$" stays text, never a regex substitution
        Assert.Contains("\"@type\":\"Church\"", html, StringComparison.Ordinal);
        Assert.Contains("\"streetAddress\":\"Fixture street\"", html, StringComparison.Ordinal);
        var policy = string.Join(" ", published.Headers.GetValues("Content-Security-Policy"));
        Assert.DoesNotContain("fonts.g", policy, StringComparison.OrdinalIgnoreCase); // Google sign-in stays in form-action; Google Fonts are gone
        Assert.Contains("font-src 'self' data:", policy, StringComparison.Ordinal);
        var sitemap = await client.GetStringAsync("/sitemap.xml");
        Assert.Contains($"<loc>https://localhost/public.html?parish={staff.Parish}</loc>", sitemap, StringComparison.Ordinal);
        Assert.Contains("<loc>https://localhost/privacy.html</loc>", sitemap, StringComparison.Ordinal);
        Assert.DoesNotContain("fonts.g", FrontendHostingExtensions.ContentSecurityPolicy(web), StringComparison.OrdinalIgnoreCase);

        // Not for search results: the API and a guest's tracking link.
        Assert.Equal("noindex, nofollow", (await client.GetAsync("/api/auth/csrf")).Headers.GetValues("X-Robots-Tag").Single());
        Assert.Equal("noindex, nofollow", (await client.GetAsync("/public.html?track=private-token")).Headers.GetValues("X-Robots-Tag").Single());
        Assert.False(published.Headers.Contains("X-Robots-Tag"));
    }

    [Fact]
    public async Task Sign_up_records_the_accepted_terms_version_and_time()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = "terms-" + Guid.NewGuid().ToString("N") + "@fixture.example";
        await f.Services.GetRequiredService<AccountService>().RegisterAsync(new RegisterAccountDto
        { OperationId = Guid.NewGuid(), Email = email, Password = Password, DisplayName = "New member", AgeConfirmed = true }, default);
        var user = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByEmailAsync(email))!;
        Assert.Equal(AccountService.TermsVersion, user.TermsVersion);
        Assert.Equal(f.Clock.Now, user.TermsAcceptedAt);
    }
}
