// Purpose: Agent 09 item 5, the signed-in half of the endpoint authorization sweep (EndpointAuthorizationSweepTests covers logged-out
// callers). Every mapped endpoint is called by a stranger: a verified account with an authenticator, signed in with MFA, that holds no role
// anywhere. Route values name a real parish and archdiocese owned by another account, that account's id, its personal note and its own
// session, so each call is an attempt at someone else's data (IDOR/BOLA). Only the reviewed list below may succeed; everything else must be
// refused. Afterwards the owner's note and session are checked to be untouched.
// Main test: A_stranger_gets_nothing_from_another_accounts_parish_archdiocese_or_personal_data.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Identity;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class EndpointAccessSweepTests
{
    // Signed-in endpoints any account may use on these ids by design, reviewed one by one (hardening/reports/09-qa.md, item 5).
    private static readonly string[] ReviewedForAnyAccount =
    [
        // The caller's own account, profile, sessions, sign-in methods, notifications and personal workspace (no foreign id involved).
        "GET api/account/records", "GET api/account/signature", "GET api/auth/account/data", "GET api/auth/external", "GET api/auth/me",
        "GET api/auth/mfa/status", "GET api/auth/passkeys", "GET api/auth/profile", "GET api/auth/sessions", "GET api/auth/staff-appointments",
        "GET api/capabilities", "GET api/me/capacities", "GET api/me/home", "GET api/me/notification-topics", "GET api/me/parishes",
        "GET api/me/personal-workspace", "GET api/me/request-claims", "GET api/notifications", "GET api/notifications/preferences",
        "PUT api/notifications/preferences", "GET api/report-deliveries", "GET api/report-schedules", "POST api/auth/profile/appearance/preview",
        // Revoking a session is scoped to the caller's own account: the owner's session id is a no-op (checked below: the owner stays signed in).
        "POST api/auth/sessions/{sessionId:guid}/revoke",
        // The operator's clergy title list and the title printed beside a priest's name on documents: readable by any signed-in account.
        "GET api/clergy-titles", "GET api/clergy-titles/accounts/{accountId:guid}",
        // Anyone may follow or stop following a parish.
        "POST api/parishes/{parishId:guid}/follow", "DELETE api/parishes/{parishId:guid}/follow",
        // "Mine" lists in a parish: only what the caller sent or owns there (empty for the stranger, checked below).
        "GET api/parishes/{parishId:guid}/broadcasts/mine", "GET api/parishes/{parishId:guid}/concerns/mine", "GET api/parishes/{parishId:guid}/inbox",
        "GET api/parishes/{parishId:guid}/inbox/reports/mine", "GET api/parishes/{parishId:guid}/me/data-closure-requests",
        "GET api/parishes/{parishId:guid}/membership-requests/mine", "GET api/parishes/{parishId:guid}/prayer-intentions/mine",
        "GET api/parishes/{parishId:guid}/requests/mine", "GET api/parishes/{parishId:guid}/workflow-runs/worklist",
        // Pastoral notes the caller wrote, or that a priest shared with them as a priest (PastoralNoteService.ListAsync): empty here.
        "GET api/parishes/{parishId:guid}/pastoral-notes"
    ];

    [Fact]
    public async Task A_stranger_gets_nothing_from_another_accounts_parish_archdiocese_or_personal_data()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await IndependentParishScenario.CreateAsync(f); // f.Other owns the parish
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var strangerEmail = (await users.FindByIdAsync(await f.CreateVerifiedStaffAsync()))!.Email!;
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["ForwardedHeaders:Enabled"] = "true" }, _ => { });

        using var owner = factory.Client();
        await LoginAsync(owner, "other@fixture.example");
        var note = (await Read<JsonElement>(await owner.PostAsJsonAsync("/api/me/personal-workspace",
            new { operationId = Guid.NewGuid(), kind = "Note", body = "The owner's private note" }))).GetProperty("value").GetProperty("id").GetString()!;
        var session = (await Read<JsonElement>(await owner.GetAsync("/api/auth/sessions"))).EnumerateArray().First().GetProperty("id").GetString()!;
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["parishId"] = s.Parish, ["archdioceseId"] = s.Archdiocese, ["organizationId"] = s.Archdiocese, ["accountId"] = f.Other,
            ["itemId"] = note, ["sessionId"] = session
        };

        using var stranger = factory.Client();
        await LoginAsync(stranger, strangerEmail);
        var succeeded = new List<string>();
        var statuses = new SortedDictionary<int, int>();
        var count = 0;
        foreach (var (method, endpoint) in factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"]).Select(m => (m, e)))
            .Where(x => x.e.Metadata.GetMetadata<IAllowAnonymous>() is null)
            .Where(x => x.e.RoutePattern.RawText is not ("api/auth/logout" or "api/auth/sessions/revoke-others"))) // would end the stranger's own session
        {
            count++;
            using var request = new HttpRequestMessage(new HttpMethod(method), Fill(endpoint.RoutePattern, values));
            request.Headers.Add("X-Forwarded-For", $"198.51.{count / 250}.{count % 250}");
            if (method is "POST" or "PUT" or "PATCH")
            {
                var type = endpoint.Metadata.GetMetadata<IAcceptsMetadata>()?.ContentTypes.FirstOrDefault() ?? "application/json";
                request.Content = new StringContent(type.Contains("json") ? "{}" : string.Empty);
                request.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(type.StartsWith("multipart/") ? type + "; boundary=sweep" : type);
            }
            var response = await stranger.SendAsync(request);
            var status = (int)response.StatusCode;
            statuses[status] = statuses.GetValueOrDefault(status) + 1;
            if (status < 300)
                succeeded.Add($"{method} {endpoint.RoutePattern.RawText}");
        }
        Assert.True(count > 500, $"only {count} endpoints found");
        var unexpected = succeeded.Distinct().Except(ReviewedForAnyAccount).Order(StringComparer.Ordinal).ToArray();
        Assert.True(unexpected.Length == 0, $"statuses {string.Join(", ", statuses.Select(x => $"{x.Key}:{x.Value}"))}\nsucceeded for the stranger:\n"
            + string.Join("\n", unexpected.Select(u => $"        \"{u}\",")));

        // The parish lists the stranger could read hold nothing of the owner's parish.
        foreach (var mine in ReviewedForAnyAccount.Where(r => r.StartsWith("GET api/parishes/", StringComparison.Ordinal)))
        {
            var list = await Read<JsonElement>(await stranger.GetAsync("/" + mine[4..].Replace("{parishId:guid}", s.Parish, StringComparison.Ordinal)));
            Assert.True((list.ValueKind == JsonValueKind.Array ? list : list.GetProperty("items")).GetArrayLength() == 0, mine + ": " + list);
        }
        // The owner's own data is untouched and the owner is still signed in.
        Assert.Contains("The owner's private note", await owner.GetStringAsync("/api/me/personal-workspace/" + note), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/auth/me")).StatusCode);
    }

    // Named route values take the real ids; every other value is a fresh GUID that names nothing.
    private static string Fill(RoutePattern pattern, IReadOnlyDictionary<string, string> values)
        => "/" + string.Join('/', pattern.PathSegments.Select(segment => string.Concat(segment.Parts.Select(part => part switch
        {
            RoutePatternLiteralPart literal => literal.Content,
            RoutePatternSeparatorPart separator => separator.Content,
            RoutePatternParameterPart parameter => values.TryGetValue(parameter.Name, out var value) ? value : Guid.NewGuid().ToString(),
            _ => string.Empty
        }))));
}
