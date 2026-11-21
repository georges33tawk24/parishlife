// Purpose: one sweep over every mapped API endpoint (Part B 19 of the hardening run): each endpoint that is not deliberately anonymous
// answers 401 to an anonymous caller, and the anonymous set is exactly the reviewed list below, so a new [AllowAnonymous] action fails
// here until it is reviewed. Object-level (IDOR/BOLA) checks stay in the per-feature tests.
// Main tests: Every_protected_endpoint_refuses_anonymous_callers, Anonymous_endpoints_are_exactly_the_reviewed_list.

using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class EndpointAuthorizationSweepTests
{
    // Reviewed in hardening/reports/03-security.md (Part B 19): sign-in and sign-up steps, public site reads, guest requests and tracking
    // (token-checked), document verification, site counts, health, plans catalogue and the OAuth completion.
    private static readonly string[] ReviewedAnonymous =
    [
        "GET /health/live",
        "GET /health/ready",
        "GET api/auth/capabilities",
        "GET api/auth/csrf",
        "GET api/auth/external/complete",
        "GET api/plans",
        "GET api/public/app/manifest",
        "GET api/public/app/offline-policy",
        "GET api/public/document-verifications/{code}",
        "GET api/public/homepage",
        "GET api/public/parishes",
        "GET api/public/parishes/{parishId:guid}/announcements",
        "GET api/public/parishes/{parishId:guid}/calendar",
        "GET api/public/parishes/{parishId:guid}/calendar.ics",
        "GET api/public/parishes/{parishId:guid}/liturgical-calendar",
        "GET api/public/parishes/{parishId:guid}/ministries",
        "GET api/public/parishes/{parishId:guid}/prayer-intentions",
        "GET api/public/parishes/{parishId:guid}/profile",
        "GET api/public/parishes/{parishId:guid}/profile/photos/{photoId:guid}",
        "GET api/public/parishes/{parishId:guid}/requests/{requestId:guid}",
        "GET api/public/parishes/{parishId:guid}/requests/{requestId:guid}/files",
        "GET api/public/parishes/{parishId:guid}/requests/{requestId:guid}/letters",
        "GET api/public/parishes/{parishId:guid}/requests/{requestId:guid}/messages",
        "GET api/public/parishes/{parishId:guid}/website",
        "POST api/auth/contact-verification",
        "POST api/auth/contact-verification/confirm",
        "POST api/auth/external/pending-challenge",
        "POST api/auth/external/{provider}/sign-in",
        "POST api/auth/external/{provider}/sign-up",
        "POST api/auth/login",
        "POST api/auth/login/mfa",
        "POST api/auth/login/mfa/recovery",
        "POST api/auth/login/passkey",
        "POST api/auth/login/passkey/options",
        "POST api/auth/password-reset",
        "POST api/auth/password-reset/confirm",
        "POST api/auth/register",
        "POST api/public/parishes/nearby",
        "POST api/public/parishes/{parishId:guid}/requests",
        "POST api/public/parishes/{parishId:guid}/requests/{requestId:guid}/actions",
        "POST api/public/parishes/{parishId:guid}/requests/{requestId:guid}/files",
        "POST api/public/parishes/{parishId:guid}/requests/{requestId:guid}/messages",
        "POST api/public/site-metrics",
    ];

    [Fact]
    public async Task Every_protected_endpoint_refuses_anonymous_callers()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        // A fresh forwarded address per request keeps the per-address rate limit out of the way (the front end's hop is trusted here).
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["ForwardedHeaders:Enabled"] = "true" }, _ => { });
        using var client = factory.Client();
        var failures = new List<string>();
        var count = 0;
        foreach (var (method, endpoint) in Endpoints(factory).Where(e => !Anonymous(e.Endpoint)))
        {
            count++;
            using var request = new HttpRequestMessage(new HttpMethod(method), Path(endpoint.RoutePattern));
            request.Headers.Add("X-Forwarded-For", $"198.51.100.{count % 250}, 203.0.{count / 250}.{count % 250}");
            if (method is "POST" or "PUT" or "PATCH")
            {
                // Upload actions accept only their declared form types; anything else would stop at 415 before authorization.
                var type = endpoint.Metadata.GetMetadata<IAcceptsMetadata>()?.ContentTypes.FirstOrDefault() ?? "application/json";
                request.Content = new StringContent(type.Contains("json") ? "{}" : string.Empty);
                request.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(type.StartsWith("multipart/") ? type + "; boundary=sweep" : type);
            }
            var status = (await client.SendAsync(request)).StatusCode;
            if (status != HttpStatusCode.Unauthorized)
                failures.Add($"{method} {endpoint.RoutePattern.RawText}: {(int)status}");
        }
        Assert.True(count > 500, $"only {count} protected endpoints found");
        Assert.True(failures.Count == 0, string.Join("\n", failures));
    }

    [Fact]
    public async Task Anonymous_endpoints_are_exactly_the_reviewed_list()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        var anonymous = Endpoints(factory).Where(e => Anonymous(e.Endpoint)).Select(e => e.Method + " " + e.Endpoint.RoutePattern.RawText)
            .Distinct().Order(StringComparer.Ordinal).ToArray();
        Assert.True(ReviewedAnonymous.SequenceEqual(anonymous), "Anonymous endpoints:\n" + string.Join("\n", anonymous.Select(a => $"        \"{a}\",")));
    }

    private static IEnumerable<(string Method, RouteEndpoint Endpoint)> Endpoints(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory)
        => factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"]).Select(m => (m, e)));

    private static bool Anonymous(Endpoint endpoint) => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null;

    // Every route value becomes a fresh GUID, which satisfies the guid constraints and names nothing that exists.
    private static string Path(RoutePattern pattern)
        => "/" + string.Join('/', pattern.PathSegments.Select(segment => string.Concat(segment.Parts.Select(part => part switch
        {
            RoutePatternLiteralPart literal => literal.Content,
            RoutePatternSeparatorPart separator => separator.Content,
            RoutePatternParameterPart => Guid.NewGuid().ToString(),
            _ => string.Empty
        }))));
}
