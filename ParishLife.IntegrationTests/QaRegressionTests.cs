// Purpose: Agent 09 regressions for fixes that had no automated test yet (item 3), everyday-user cases (item 14) and abuse limits (item 15).
// Each test is named after the fix or the behaviour it holds in place. Known failures prove bugs reported in hardening/handoffs/from-09-qa.md.
// Main tests: website section markup sanitized on save (03 B6); pages compressed but /api never (04 #1, BREACH); differently capitalized
// sign-in email; Apple relay address at sign-up; reset and verification codes expire; a link scanner's GET never spends a code; a double-tapped or retried create makes one
// record; photo location metadata (known failure); sign-up and code requests limited per client; a daily cap on code emails per address
// (known failure); an oversized upload refused before its body is read.

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Services.Accounts;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Publishing;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class QaRegressionTests
{
    // 03 B6 (second half): website section bodies were stored raw and sanitized only in the browser.
    [Fact]
    public async Task Website_section_markup_is_sanitized_when_saved()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core"]);
        var author = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PublishingManage]));
        f.AsAppointment(f.Other, author.Id);
        var section = await f.Services.GetRequiredService<WebsiteService>().SaveDraftAsync(staff.Parish, "about", new SaveWebsiteDraftDto
        {
            OperationId = Guid.NewGuid(),
            Texts = new() { ["en"] = new WebsiteTextDto { Title = "About", Body = "<div onmouseover=\"steal()\">Welcome <a href=\"javascript:alert(1)\">here</a><iframe src=\"https://evil.example\"></iframe><svg onload=alert(2)></svg><a href=\"https://parish.example/x\">site</a></div>" } }
        }, default);
        Assert.Equal("<p>Welcome here<a href=\"https://parish.example/x\" target=\"_blank\" rel=\"noopener noreferrer\">site</a></p>", section.Pending!.Texts["en"].Body);
    }

    // 04 #1 (applied by 03 in sweep 1): pages, scripts and styles are compressed; /api answers never are (BREACH).
    [Fact]
    public async Task Static_pages_are_compressed_and_api_answers_are_not()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var web = Path.Combine(f.DirectoryPath, "web");
        Directory.CreateDirectory(web);
        await File.WriteAllTextAsync(Path.Combine(web, "index.html"), "<!doctype html><html><head><title>Sign in</title></head><body>" + string.Concat(Enumerable.Repeat("<p>ParishLife</p>", 400)) + "</body></html>");
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["webroot"] = web }, _ => { });
        using var client = factory.Client();
        foreach (var (encoding, path, compressed) in new[] { ("br", "/index.html", true), ("gzip", "/index.html", true), ("br, gzip", "/api/auth/csrf", false), ("br, gzip", "/api/public/parishes", false) })
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, path);
            request.Headers.Add("Accept-Encoding", encoding);
            var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(compressed ? encoding : null, response.Content.Headers.ContentEncoding.SingleOrDefault());
        }
    }

    // Item 14: a person types their address with different capitals than at sign-up.
    [Fact]
    public async Task Sign_in_works_with_a_differently_capitalized_email()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(await f.CreateVerifiedMemberAsync()))!.Email!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await LoginAsync(client, "  " + email.ToUpperInvariant() + " ");
        Assert.Equal(email, (await Read<JsonElement>(await client.GetAsync("/api/auth/me"))).GetProperty("email").GetString());
    }

    // Item 14: Sign in with Apple's "hide my email" relay addresses are ordinary addresses and are kept exactly as typed.
    [Fact]
    public async Task Sign_up_accepts_an_apple_relay_address_as_typed()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await Csrf(client);
        var email = "x7k2m9q4pz" + Guid.NewGuid().ToString("N")[..6] + "@privaterelay.appleid.com";
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/register",
            new { operationId = Guid.NewGuid(), email, password = Password, displayName = "Relay user", ageConfirmed = true })).StatusCode);
        Assert.Equal(email, (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByEmailAsync(email))!.Email);
    }

    // Item 14: mail scanners open links with GET. Codes are typed into a POST form, and no GET route accepts one, so a scan spends nothing.
    [Fact]
    public async Task A_link_scanners_get_never_spends_a_code()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var user = (await users.FindByIdAsync(await f.CreateVerifiedMemberAsync()))!;
        user.EmailConfirmed = true; // controlled setup; confirmation itself is covered by AccountContactTests
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        var delivery = new CapturedContactDelivery();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new(), services => services.AddScoped<IContactCodeDelivery>(_ => delivery));
        using var client = factory.Client();
        await Csrf(client);
        await client.PostAsJsonAsync("/api/auth/password-reset", new { email = user.Email });
        var code = Assert.Single(delivery.Sent).Code;
        var query = $"?email={Uri.EscapeDataString(user.Email!)}&code={code}&newPassword=scanner-chosen-password-123";
        foreach (var path in new[] { "/api/auth/password-reset/confirm", "/api/auth/contact-verification/confirm", "/api/auth/password-reset", "/index.html" })
        {
            var scan = await client.GetAsync(path + query);
            Assert.True(scan.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed, $"{path}: {scan.StatusCode}");
        }
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/password-reset/confirm",
            new { email = user.Email, code, newPassword = "a-new-isolated-fixture-password" })).StatusCode);
    }

    // Items 6 and 7: an emailed code is good for 15 minutes; one minute later the right code no longer works, for a reset and for
    // an email confirmation alike.
    [Fact]
    public async Task Reset_and_verification_codes_expire_after_15_minutes()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var confirmed = (await users.FindByIdAsync(await f.CreateVerifiedMemberAsync()))!;
        confirmed.EmailConfirmed = true;
        Assert.True((await users.UpdateAsync(confirmed)).Succeeded);
        var pending = "pending-" + Guid.NewGuid().ToString("N") + "@fixture.example";
        await f.Services.GetRequiredService<AccountService>().RegisterAsync(new RegisterAccountDto
        { OperationId = Guid.NewGuid(), Email = pending, Password = Password, DisplayName = "Pending", AgeConfirmed = true }, default);
        var delivery = new CapturedContactDelivery();
        var service = ActivatorUtilities.CreateInstance<ContactVerificationService>(f.Services, delivery);
        await service.RequestPasswordResetAsync(new RequestPasswordResetDto { Email = confirmed.Email! }, default);
        await service.RequestAsync(new RequestContactVerificationDto { Email = pending }, default);
        Assert.Equal(2, delivery.Sent.Count);
        f.Clock.Now = f.Clock.Now.AddMinutes(16);
        Assert.Equal("verification_invalid", (await Assert.ThrowsAsync<DomainException>(() => service.ConfirmPasswordResetAsync(new ConfirmPasswordResetDto
        { Email = confirmed.Email!, Code = delivery.Sent[0].Code, NewPassword = "a-new-isolated-fixture-password" }, default))).Code);
        Assert.Equal("verification_invalid", (await Assert.ThrowsAsync<DomainException>(() => service.ConfirmAsync(new ConfirmContactVerificationDto
        { Email = pending, Code = delivery.Sent[1].Code }, default))).Code);
        Assert.False((await users.FindByEmailAsync(pending))!.EmailConfirmed);
    }

    // Item 14: a double tap, or a retry after the connection dropped right after submitting, sends the same operation id: one record.
    [Fact]
    public async Task A_double_tapped_or_retried_create_makes_one_record()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(await f.CreateVerifiedMemberAsync()))!.Email!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await LoginAsync(client, email);
        var body = new { operationId = Guid.NewGuid(), kind = "Note", body = "Pray for Hanna" };
        var answers = await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => client.PostAsJsonAsync("/api/me/personal-workspace", body)));
        var retry = await client.PostAsJsonAsync("/api/me/personal-workspace", body); // the "lost connection" resend
        var ids = new List<string>();
        foreach (var answer in answers.Append(retry))
            ids.Add((await Read<JsonElement>(answer)).GetProperty("value").GetProperty("id").GetString()!);
        Assert.Single(ids.Distinct());
        var list = await Read<JsonElement>(await client.GetAsync("/api/me/personal-workspace"));
        Assert.Equal(1, list.GetProperty("items").GetArrayLength());
    }

    // Item 14: a phone photo carries its GPS position in EXIF. Public parish photos are served byte for byte, location included.
    [Fact] // from-09-qa.md #2, fixed: uploads lose their EXIF, XMP, IPTC and comments (PhotoMetadata; owner decision 23 November 2026)
    public async Task A_published_photo_is_served_without_its_location_metadata()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PublishingManage]));
        f.AsAppointment(f.Other, appointment.Id);
        var photos = f.Services.GetRequiredService<ParishProfileService>();
        var photo = await photos.UploadPhotoAsync(staff.Parish, Guid.NewGuid(), "image/jpeg", JpegWithGps, null, null, default);
        photo = await photos.PhotoActAsync(staff.Parish, photo.Id, new ParishProfilePhotoActionDto { OperationId = Guid.NewGuid(), Version = photo.Version, Action = "publish" }, default);
        var served = (await photos.PublicPhotoAsync(staff.Parish, photo.Id, default)).Content;
        Assert.DoesNotContain("Exif", Encoding.ASCII.GetString(served), StringComparison.Ordinal);
    }

    // Item 15: sign-up and code requests share the per-client sign-in budget (20 a minute); the 21st is refused.
    [Fact]
    public async Task Sign_up_and_code_requests_from_one_client_are_limited()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        foreach (var (path, body) in new (string, Func<int, object>)[]
        {
            ("/api/auth/register", i => new { operationId = Guid.NewGuid(), email = $"flood-{i}-{Guid.NewGuid():N}@fixture.example", password = Password, displayName = "Flood", ageConfirmed = true }),
            ("/api/auth/password-reset", i => new { email = $"target-{i}@fixture.example" }),
            ("/api/auth/contact-verification", i => new { email = $"target-{i}@fixture.example" })
        })
        {
            // A fresh host per path: its limiter starts empty, as for a client that has not called before.
            await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new(), services => services.AddScoped<IContactCodeDelivery>(_ => new CapturedContactDelivery()));
            using var client = factory.Client();
            await Csrf(client);
            var statuses = new List<HttpStatusCode>();
            for (var i = 0; i < 21; i++)
                statuses.Add((await client.PostAsJsonAsync(path, body(i))).StatusCode);
            Assert.DoesNotContain(HttpStatusCode.TooManyRequests, statuses.Take(20));
            Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
        }
    }

    // Item 15: one address can be sent a code once a minute, which is still up to 1,440 emails a day to a victim's inbox (and on the bill).
    [Fact] // from-09-qa.md #3, fixed: 10 codes per account and purpose in 24 hours (owner decision, 23 November 2026)
    public async Task Code_emails_to_one_address_stop_at_a_daily_cap()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var user = (await users.FindByIdAsync(await f.CreateVerifiedMemberAsync()))!;
        user.EmailConfirmed = true;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        var delivery = new CapturedContactDelivery();
        var service = ActivatorUtilities.CreateInstance<ContactVerificationService>(f.Services, delivery);
        for (var i = 0; i < 30; i++)
        {
            await service.RequestPasswordResetAsync(new RequestPasswordResetDto { Email = user.Email! }, default);
            f.Clock.Now = f.Clock.Now.AddMinutes(1).AddSeconds(1);
        }
        Assert.True(delivery.Sent.Count <= 10, $"{delivery.Sent.Count} reset emails to one address within 31 minutes");
        Assert.Equal(10, delivery.Sent.Count); // the cap, not something stricter
        f.Clock.Now = f.Clock.Now.AddHours(24); // a new 24-hour window
        await service.RequestPasswordResetAsync(new RequestPasswordResetDto { Email = user.Email! }, default);
        Assert.Equal(11, delivery.Sent.Count);
    }

    // Item 15: an oversized upload is refused as soon as its headers arrive (50 MB declared, 1 KB sent); the body is never read or stored.
    [Fact]
    public async Task An_oversized_upload_is_refused_before_its_body_is_read()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var host = RawHttp.Kestrel(f.DirectoryPath, out var server);
        var csrf = await RawHttp.SendAsync(server, "GET /api/auth/csrf HTTP/1.1\r\nHost: localhost\r\nX-Forwarded-Proto: https\r\nConnection: close\r\n\r\n");
        var cookie = csrf.Split("\r\n").First(line => line.StartsWith("Set-Cookie: __Host-ParishLife.Csrf=", StringComparison.OrdinalIgnoreCase))["Set-Cookie: ".Length..].Split(';')[0];
        var json = csrf[csrf.IndexOf('{', StringComparison.Ordinal)..(csrf.LastIndexOf('}') + 1)]; // the body may arrive chunked
        var token = JsonDocument.Parse(json).RootElement.GetProperty("token").GetString();
        const long fiftyMegabytes = 50L * 1024 * 1024;
        var headers = $"POST /api/public/parishes/{Guid.NewGuid()}/requests/{Guid.NewGuid()}/files HTTP/1.1\r\nHost: localhost\r\nX-Forwarded-Proto: https\r\n"
            + $"Cookie: {cookie}\r\nX-CSRF-TOKEN: {token}\r\nX-ParishLife-Tracking: x\r\nContent-Type: multipart/form-data; boundary=b\r\nContent-Length: {fiftyMegabytes}\r\n\r\n";
        var started = DateTime.UtcNow;
        var answer = await RawHttp.SendAsync(server, headers + "--b\r\nContent-Disposition: form-data; name=\"file\"; filename=\"big.pdf\"\r\n\r\n%PDF-" + new string('x', 1024), waitMs: 10000);
        // Kestrel refuses the declared length at the first read; MVC's form binding reports that as a 400 naming the limit.
        Assert.True(answer.StartsWith("HTTP/1.1 413", StringComparison.Ordinal)
            || answer.StartsWith("HTTP/1.1 400", StringComparison.Ordinal) && answer.Contains("Request body too large", StringComparison.Ordinal), answer);
        Assert.True(DateTime.UtcNow - started < TimeSpan.FromSeconds(10), "the server waited for the body");
    }

    // A minimal JPEG whose APP1 segment is EXIF with a GPS IFD pointer (tag 0x8825), as a phone camera writes it.
    private static readonly byte[] JpegWithGps =
    [
        0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x22, (byte)'E', (byte)'x', (byte)'i', (byte)'f', 0, 0,
        (byte)'M', (byte)'M', 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1A,
        0x00, 0x00, 0x00, 0x00, 0xFF, 0xD9
    ];
}
