// Purpose: Agent 09 item 4: the attack techniques of hardening/reports/03-security.md that had no automated test yet, each tried against the
// real API, plus cookie flags, CSRF on every write, and injection through search. Techniques already covered elsewhere are mapped in
// hardening/reports/09-qa.md (for example TOTP replay, spoofed forwarded addresses and Unicode look-alikes in SecurityHardeningHttpTests).
// Main tests: 72-character password prefix (bcrypt truncation), absent surfaces (GraphQL, SAML, WebSocket), ambiguous request framing on
// Kestrel (smuggling), forwarded or foreign host headers (cache poisoning), login timing for unknown and known accounts (known failure),
// tampered session cookies (padding oracle), prototype and privilege keys in JSON (mass assignment), XML/SVG/HEIC uploads (XXE), session and
// CSRF cookie flags, every unsafe endpoint refusing a signed-in caller without the CSRF token, and search text that looks like SQL or NoSQL.

using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Configuration;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Files;
using ParishLife.Api.Services.Publishing;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class AttackTechniqueTests
{
    // Attack technique 2: bcrypt keeps only 72 bytes. The Identity hasher (PBKDF2) uses the whole password, and over-long input is refused
    // before any hashing.
    [Fact]
    public async Task Passwords_that_share_their_first_72_characters_are_different_passwords()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var prefix = new string('p', 72);
        var email = "long-" + Guid.NewGuid().ToString("N") + "@fixture.example";
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var user = new ParishUser { Id = Guid.NewGuid().ToString("N"), UserName = email, Email = email, DisplayName = "Long password" };
        Assert.True((await users.CreateAsync(user, prefix + "-the-real-ending")).Succeeded);
        user.IdentityVerified = true;
        user.ContactVerificationReference = "isolated verification fixture";
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await Csrf(client);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = prefix + "-another-ending" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = prefix })).StatusCode);
        Assert.Contains((await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = new string('x', 201) })).StatusCode,
            new[] { HttpStatusCode.BadRequest, HttpStatusCode.Unauthorized }); // refused by the DTO limit before any hashing
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/register",
            new { operationId = Guid.NewGuid(), email = "other-" + email, password = new string('x', 201), displayName = "Too long", ageConfirmed = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = prefix + "-the-real-ending" })).StatusCode);
    }

    // Techniques 3, 5 and 19: there is no SAML, GraphQL or WebSocket endpoint to attack.
    [Fact]
    public async Task Graphql_saml_and_websocket_endpoints_do_not_exist()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await Csrf(client);
        foreach (var path in new[] { "/graphql", "/api/graphql", "/saml/acs", "/api/auth/saml/acs", "/Saml2/Acs" })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync(path, new { query = "{ a: __typename b: __typename }" })).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(path)).StatusCode);
        }
        var sockets = factory.Server.CreateWebSocketClient();
        foreach (var path in new[] { "/ws", "/api/ws", "/hub", "/api/auth/me" })
            await Assert.ThrowsAnyAsync<Exception>(() => sockets.ConnectAsync(new Uri("wss://localhost" + path), default));
    }

    // Technique 9: request smuggling needs two parsers that disagree about where a request ends. Kestrel refuses ambiguous framing outright
    // and closes the connection, so nothing hidden after the first request is ever run.
    [Fact]
    public async Task Ambiguous_request_framing_is_refused_and_the_hidden_request_never_runs()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var host = RawHttp.Kestrel(f.DirectoryPath, out var server);
        const string hidden = "GET /api/auth/me HTTP/1.1\r\nHost: localhost\r\n\r\n";
        var cases = new Dictionary<string, string>
        {
            ["two different Content-Length values"] = "POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 2\r\nContent-Length: 40\r\n\r\n{}" + hidden,
            ["a transfer coding that does not end in chunked"] = "POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked, identity\r\n\r\n0\r\n\r\n" + hidden,
            ["an obsolete folded header"] = "POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 2\r\n Transfer-Encoding: chunked\r\n\r\n{}" + hidden,
            ["a space before the colon"] = "POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nTransfer-Encoding : chunked\r\nContent-Length: 2\r\n\r\n{}" + hidden
        };
        foreach (var (name, request) in cases)
        {
            var answer = await RawHttp.SendAsync(server, request);
            Assert.True(answer.StartsWith("HTTP/1.1 400", StringComparison.Ordinal), $"{name}: {answer.Split("\r\n")[0]}");
            Assert.True(RawHttp.Count(answer) == 1, $"{name}: the hidden request was answered too");
        }
        // Content-Length together with Transfer-Encoding: chunked wins and the connection is not reused, so a smuggled tail cannot ride it.
        var both = await RawHttp.SendAsync(server, "POST /api/auth/login HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 50\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n" + hidden);
        Assert.True(RawHttp.Count(both) <= 1 || !both.Contains("HTTP/1.1 200", StringComparison.Ordinal), both.Split("\r\n")[0]);
    }

    // Technique 10: nothing the caller controls besides path and query varies a cached or generated public answer. A foreign Host is
    // refused (AllowedHosts) and X-Forwarded-Host is not trusted, so the generated sitemap and canonical links cannot be pointed elsewhere.
    [Fact]
    public async Task Forwarded_or_foreign_host_headers_cannot_poison_public_answers()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var web = Path.Combine(f.DirectoryPath, "web");
        Directory.CreateDirectory(web);
        await File.WriteAllTextAsync(Path.Combine(web, "index.html"), "<!doctype html><html><head><title>Sign in</title></head><body></body></html>");
        await File.WriteAllTextAsync(Path.Combine(web, "public.html"), "<!doctype html><html><head><title>Find your parish</title></head><body></body></html>");
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["webroot"] = web, ["ForwardedHeaders:Enabled"] = "true" }, _ => { });
        using var client = factory.Client();
        foreach (var path in new[] { "/sitemap.xml", "/api/public/parishes", "/api/public/app/offline-policy" })
        {
            using var poisoned = new HttpRequestMessage(HttpMethod.Get, path);
            poisoned.Headers.Add("X-Forwarded-Host", "evil.example");
            poisoned.Headers.Add("X-Original-URL", "/api/auth/me");
            poisoned.Headers.Add("X-Rewrite-URL", "/api/auth/me");
            var first = await client.SendAsync(poisoned);
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
            Assert.DoesNotContain("evil.example", await first.Content.ReadAsStringAsync(), StringComparison.Ordinal);
            Assert.DoesNotContain("evil.example", await client.GetStringAsync(path), StringComparison.Ordinal); // what the next visitor gets
        }
        using var foreign = new HttpRequestMessage(HttpMethod.Get, "/sitemap.xml");
        foreign.Headers.Host = "evil.example";
        Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(foreign)).StatusCode);
        Assert.Contains("<loc>https://localhost/", await client.GetStringAsync("/sitemap.xml"), StringComparison.Ordinal);
    }

    // Technique 14: a sign-in for an address with no account must take as long as a wrong password for a real one; otherwise the response
    // time tells an attacker which addresses have accounts. Today an unknown address answers before any password hashing.
    [KnownFailureFact("from-09-qa.md #1: login answers unknown addresses without hashing, so timing reveals which emails have accounts")]
    public async Task Sign_in_takes_as_long_for_an_unknown_address_as_for_a_wrong_password()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var known = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(await f.CreateVerifiedMemberAsync()))!.Email!;
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["ForwardedHeaders:Enabled"] = "true" }, _ => { });
        using var client = factory.Client();
        await Csrf(client);
        var n = 0;
        async Task<double> TimeAsync(string username)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { username, password = "a-wrong-password-of-enough-length" }) };
            request.Headers.Add("X-Forwarded-For", $"198.51.100.{++n}");
            var timer = Stopwatch.StartNew();
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(request)).StatusCode);
            return timer.Elapsed.TotalMilliseconds;
        }
        await TimeAsync("warm-up@fixture.example");
        var unknown = new List<double>();
        var wrong = new List<double>();
        for (var i = 0; i < 4; i++) // four: the fifth wrong password locks the account, and a locked account answers without hashing
        {
            unknown.Add(await TimeAsync($"nobody-{i}@fixture.example"));
            wrong.Add(await TimeAsync(known));
        }
        double Median(List<double> values) => values.Order().Skip(values.Count / 2).First();
        Assert.True(Median(wrong) - Median(unknown) < 15,
            $"wrong password for a real account: median {Median(wrong):F1} ms; unknown address: median {Median(unknown):F1} ms");
    }

    // Technique 15: tampered encrypted cookies (Data Protection: AES-CBC with HMAC, encrypt-then-MAC) all fail the same way as no cookie,
    // so no padding or MAC difference can be observed.
    [Fact]
    public async Task Tampered_session_cookies_get_the_same_answer_as_no_cookie()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(await f.CreateVerifiedMemberAsync()))!.Email!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = Bare(factory, f.DirectoryPath);
        var session = (await SignInBareAsync(client, email)).Session.Split(';')[0]["__Host-ParishLife=".Length..];
        async Task<(HttpStatusCode, string)> MeAsync(string? cookie)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
            if (cookie is not null)
                request.Headers.Add("Cookie", "__Host-ParishLife=" + cookie);
            var response = await client.SendAsync(request);
            return (response.StatusCode, await response.Content.ReadAsStringAsync());
        }
        Assert.Equal(HttpStatusCode.OK, (await MeAsync(session)).Item1);
        var none = await MeAsync(null);
        Assert.Equal(HttpStatusCode.Unauthorized, none.Item1);
        static string Flip(string value, int at) => value[..at] + (value[at] == 'A' ? 'B' : 'A') + value[(at + 1)..];
        foreach (var tampered in new[] { Flip(session, session.Length / 2), Flip(session, session.Length - 3), Flip(session, 10), session[..^4], session + "AAAA", "CfDJ8" + new string('A', 200) })
            Assert.Equal(none, await MeAsync(tampered));
    }

    // Technique 16 and mass assignment: unknown JSON keys, prototype keys included, are ignored by the typed DTOs and grant nothing.
    [Fact]
    public async Task Prototype_and_privilege_keys_in_json_are_ignored()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await Csrf(client);
        var email = "proto-" + Guid.NewGuid().ToString("N") + "@fixture.example";
        var body = $$$"""
            {"operationId":"{{{Guid.NewGuid()}}}","email":"{{{email}}}","password":"{{{Password}}}","displayName":"Plain member","ageConfirmed":true,
             "__proto__":{"platformOperator":true,"isAdmin":true},"constructor":{"prototype":{"platformOperator":true}},
             "platformOperator":true,"emailConfirmed":true,"identityVerified":true,"twoFactorEnabled":true,"active":true,"roles":["super_admin"]}
            """;
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsync("/api/auth/register", new StringContent(body, Encoding.UTF8, "application/json"))).StatusCode);
        var user = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByEmailAsync(email))!;
        Assert.Equal((false, false, false, false), (user.PlatformOperator, user.EmailConfirmed, user.IdentityVerified, user.TwoFactorEnabled));
        Assert.Equal("Plain member", user.DisplayName);
    }

    // Technique 18 (XXE) and upload restrictions: no uploaded XML is parsed; only the bytes decide the type, so SVG/XML with an external
    // entity, HTML and HEIC are refused whatever they claim to be.
    [Fact]
    public async Task Xml_svg_html_and_heic_uploads_are_refused_by_their_bytes()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PublishingManage]));
        f.AsAppointment(f.Other, appointment.Id);
        var photos = f.Services.GetRequiredService<ParishProfileService>();
        var files = new Dictionary<string, byte[]>
        {
            ["image/svg+xml"] = """<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>"""u8.ToArray(),
            ["application/xml"] = """<!DOCTYPE r [<!ENTITY x SYSTEM "http://169.254.169.254/">]><r>&x;</r>"""u8.ToArray(),
            ["image/jpeg"] = "<html><script>alert(1)</script></html>"u8.ToArray(), // claims to be a JPEG
            ["image/heic"] = [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0] // "ftypheic"
        };
        foreach (var (declared, content) in files)
        {
            Assert.Equal("invalid_file", (await Assert.ThrowsAsync<DomainException>(() =>
                photos.UploadPhotoAsync(staff.Parish, Guid.NewGuid(), declared, content, null, null, default))).Code);
            Assert.Null(EvidenceService.Detect(content));
            Assert.Null(ParishProfileService.Detect(content));
        }
    }

    [Fact]
    public async Task Session_and_csrf_cookies_are_host_only_secure_http_only_and_strict()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(await f.CreateVerifiedMemberAsync()))!.Email!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = Bare(factory, f.DirectoryPath);
        var (csrf, session) = await SignInBareAsync(client, email);
        foreach (var header in new[] { csrf, session })
        {
            var attributes = header.Split(';').Select(a => a.Trim().ToLowerInvariant()).ToArray();
            Assert.StartsWith("__host-parishlife", attributes[0], StringComparison.Ordinal);
            Assert.Contains("secure", attributes);
            Assert.Contains("httponly", attributes);
            Assert.Contains("samesite=strict", attributes);
            Assert.Contains("path=/", attributes);
            Assert.DoesNotContain(attributes, a => a.StartsWith("domain=", StringComparison.Ordinal));
        }
        Assert.DoesNotContain("expires=", session, StringComparison.OrdinalIgnoreCase); // a browser-session cookie; the server ends it after 8 h
    }

    // CSRF: the global filter covers every unsafe endpoint, anonymous ones included, for a signed-in caller without the token.
    [Fact]
    public async Task Every_unsafe_endpoint_refuses_a_signed_in_caller_without_the_csrf_token()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var email = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(await f.CreateVerifiedMemberAsync()))!.Email!;
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["ForwardedHeaders:Enabled"] = "true" }, _ => { });
        using var client = factory.Client();
        await LoginAsync(client, email);
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        var failures = new List<string>();
        var count = 0;
        foreach (var (method, endpoint) in factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? []).Select(m => (m, e)))
            .Where(x => x.m is "POST" or "PUT" or "PATCH" or "DELETE"))
        {
            count++;
            using var request = new HttpRequestMessage(new HttpMethod(method), Fill(endpoint.RoutePattern));
            request.Headers.Add("X-Forwarded-For", $"198.51.{count / 250}.{count % 250}");
            var type = endpoint.Metadata.GetMetadata<IAcceptsMetadata>()?.ContentTypes.FirstOrDefault() ?? "application/json";
            request.Content = new StringContent(type.Contains("json") ? "{}" : string.Empty);
            request.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(type.StartsWith("multipart/") ? type + "; boundary=sweep" : type);
            var response = await client.SendAsync(request);
            if (response.StatusCode != HttpStatusCode.BadRequest || await Title(response) != "csrf_invalid")
                failures.Add($"{method} {endpoint.RoutePattern.RawText}: {(int)response.StatusCode}");
        }
        Assert.True(count > 300, $"only {count} unsafe endpoints found");
        Assert.True(failures.Count == 0, string.Join("\n", failures));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode); // still signed in: nothing logged us out
    }

    // SQL/NoSQL injection: storage queries are parameterized (no SQL; Cosmos parameters), so query text is only ever a search value.
    [Fact]
    public async Task Search_text_that_looks_like_sql_or_nosql_is_only_a_search_value()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await IndependentParishScenario.CreateAsync(f); // one verified parish in the directory
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        Assert.Contains("Isolated independent parish", await client.GetStringAsync("/api/public/parishes?q=Isolated"), StringComparison.Ordinal);
        foreach (var attack in new[] { "' OR '1'='1", "x\" OR 1=1 --", "'; SELECT * FROM c --", "{\"$ne\":null}", "{\"$gt\":\"\"}", "*", "%", "ARRAY_CONTAINS(c.data, 1)" })
        {
            var response = await client.GetAsync("/api/public/parishes?q=" + Uri.EscapeDataString(attack));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.DoesNotContain("Isolated independent parish", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        }
    }

    private static HttpClient Bare(WebApplicationFactory<Program> factory, string directory)
    {
        Assert.Equal(directory, factory.Services.GetRequiredService<StorageOptions>().LocalPath);
        return factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = false, AllowAutoRedirect = false });
    }

    // Signs in a password-only account without a cookie container and returns the raw Set-Cookie headers of the CSRF and session cookies.
    private static async Task<(string Csrf, string Session)> SignInBareAsync(HttpClient client, string email)
    {
        var csrfResponse = await client.GetAsync("/api/auth/csrf");
        var csrf = csrfResponse.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("__Host-ParishLife.Csrf=", StringComparison.Ordinal));
        var token = (await csrfResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        using var login = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { username = email, password = Password }) };
        login.Headers.Add("Cookie", csrf.Split(';')[0]);
        login.Headers.Add("X-CSRF-TOKEN", token);
        var response = await client.SendAsync(login);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = response.Headers.GetValues("Set-Cookie").Single(c => c.StartsWith("__Host-ParishLife=", StringComparison.Ordinal));
        return (csrf, session);
    }

    // Every route value becomes a fresh GUID (as in EndpointAuthorizationSweepTests).
    private static string Fill(RoutePattern pattern)
        => "/" + string.Join('/', pattern.PathSegments.Select(segment => string.Concat(segment.Parts.Select(part => part switch
        {
            RoutePatternLiteralPart literal => literal.Content,
            RoutePatternSeparatorPart separator => separator.Content,
            RoutePatternParameterPart => Guid.NewGuid().ToString(),
            _ => string.Empty
        }))));
}
