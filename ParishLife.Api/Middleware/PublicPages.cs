// Purpose: what search engines read without running JavaScript (Agent 06 handoff 6): a parish page's own head, a real 404 for a parish that
// is unknown or unverified (a verified parish with no published profile yet gets the plain page), and a sitemap generated from the
// published parishes. The served public.html is rewritten in
// memory (title, description, Open Graph, canonical link, schema.org JSON-LD); the frontend files are never edited.
// Main functions: ParishPageAsync (GET /public.html?parish=<id>) and SitemapAsync (GET /sitemap.xml). Every value comes from the published
// profile and the parish's public directory fields only (the same rules as GET /api/public/parishes/{id}/profile), and is HTML-encoded
// (JSON-LD is JSON-encoded, which escapes < and >). Anything else falls through to the static files unchanged.

using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Publishing;

namespace ParishLife.Api.Middleware;

public static partial class PublicPages
{
    private static readonly string[] StaticPages = ["public.html", "landing.html", "privacy.html", "terms.html", "cookies.html"];

    // The parish's own page, or the same page with status 404 when the parish has nothing published (the client shows its "not found" view).
    public static async Task ParishPageAsync(HttpContext context, string html)
    {
        var response = context.Response;
        response.ContentType = "text/html; charset=utf-8";
        var parish = Guid.TryParse(context.Request.Query["parish"].ToString(), out var id) ? id.ToString("N") : null;
        var page = parish is null ? null : await ProfileAsync(context, parish);
        if (page is null)
        {
            // A verified parish without a published profile is still listed in the directory and shown: the plain page, 200.
            if (parish is null || (await context.RequestServices.GetRequiredService<IParishRepository>().GetAsync(parish, context.RequestAborted))?.Value.Status != ParishStatus.Verified)
                response.StatusCode = StatusCodes.Status404NotFound;
            await response.WriteAsync(html, context.RequestAborted);
            return;
        }
        var (profile, location) = page.Value;
        var origin = Origin(context);
        var canonical = origin + "/public.html?parish=" + profile.ParishId;
        var title = profile.Name + " · ParishLife";
        var description = Description(profile);
        var head = new StringBuilder()
            .Append("<link rel=\"canonical\" href=\"").Append(Encode(canonical)).Append("\">\n")
            .Append("<script type=\"application/ld+json\">").Append(JsonLd(profile, location, canonical)).Append("</script>\n");
        html = Title().Replace(html, "<title>" + Encode(title) + "</title>", 1);
        html = Meta("name", "description").Replace(html, MetaTag("name", "description", description), 1);
        html = Meta("property", "og:title").Replace(html, MetaTag("property", "og:title", title), 1);
        html = Meta("property", "og:description").Replace(html, MetaTag("property", "og:description", description), 1);
        var end = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
        html = end < 0 ? html : html.Insert(end, head.ToString());
        await response.WriteAsync(html, context.RequestAborted);
    }

    // The static public pages plus one entry per verified parish with a published profile, last changed when it was published.
    public static async Task SitemapAsync(HttpContext context)
    {
        var origin = Origin(context);
        var services = context.RequestServices;
        var profiles = await services.GetRequiredService<IParishDirectory>().ByParishAsync<ParishProfile>("parishProfile", context.RequestAborted);
        var xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        foreach (var page in StaticPages)
            xml.Append("  <url><loc>").Append(Encode(origin + "/" + page)).Append("</loc></url>\n");
        foreach (var parish in (await services.GetRequiredService<IParishDirectory>().AllAsync(context.RequestAborted))
            .Where(p => p.Status == ParishStatus.Verified).OrderBy(p => p.Id, StringComparer.Ordinal))
            if (profiles.GetValueOrDefault(parish.Id) is { Published: not null } profile && profile.ParishId == parish.Id)
                xml.Append("  <url><loc>").Append(Encode(origin + "/public.html?parish=" + parish.Id)).Append("</loc>")
                    .Append(profile.PublishedAt is { } at ? "<lastmod>" + at.UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "</lastmod>" : string.Empty)
                    .Append("</url>\n");
        xml.Append("</urlset>\n");
        context.Response.ContentType = "application/xml; charset=utf-8";
        context.Response.Headers.CacheControl = "public, max-age=3600";
        await context.Response.WriteAsync(xml.ToString(), context.RequestAborted);
    }

    private static async Task<(PublicParishProfileDto, ParishLocation?)?> ProfileAsync(HttpContext context, string parish)
    {
        try
        {
            var profile = await context.RequestServices.GetRequiredService<ParishProfileService>().PublicAsync(parish, context.RequestAborted);
            var location = (await context.RequestServices.GetRequiredService<IRecordTransactions>()
                .ReadAsync<ParishLocation>(new RecordScope { Area = RecordArea.Parish, OwnerId = parish }, ParishLocationService.Key, context.RequestAborted))?.Value;
            return (profile, location is not null && location.ParishId == parish && location.IsRecorded() ? location : null);
        }
        catch (DomainException error) when (error.Kind == FailureKind.NotFound)
        {
            return null;
        }
    }

    private static string Description(PublicParishProfileDto profile)
    {
        var parts = new List<string> { profile.Name + (string.IsNullOrWhiteSpace(profile.Locality) ? string.Empty : ", " + profile.Locality) };
        if (!string.IsNullOrWhiteSpace(profile.Profile.Rite))
            parts.Add(profile.Profile.Rite.Trim());
        if (!string.IsNullOrWhiteSpace(profile.Profile.MassTimes))
            parts.Add("Mass times: " + profile.Profile.MassTimes.Trim());
        var text = Regex.Replace(string.Join(". ", parts), @"\s+", " ");
        return text.Length <= 160 ? text : text[..157] + "...";
    }

    private static string JsonLd(PublicParishProfileDto profile, ParishLocation? location, string canonical)
    {
        var church = new Dictionary<string, object> { ["@context"] = "https://schema.org", ["@type"] = "Church", ["name"] = profile.Name, ["url"] = canonical };
        if (!string.IsNullOrWhiteSpace(profile.Profile.Address))
            church["address"] = new Dictionary<string, object> { ["@type"] = "PostalAddress", ["streetAddress"] = profile.Profile.Address.Trim(), ["addressLocality"] = profile.Locality };
        if (location is not null)
            church["geo"] = new Dictionary<string, object> { ["@type"] = "GeoCoordinates", ["latitude"] = location.Latitude!.Value, ["longitude"] = location.Longitude!.Value };
        return JsonSerializer.Serialize(church); // the default encoder escapes <, > and & inside strings
    }

    // The address the visitor used (Host is limited by AllowedHosts); the deployed site is https only.
    private static string Origin(HttpContext context) => "https://" + context.Request.Host.Value;

    private static string Encode(string value) => WebUtility.HtmlEncode(value);

    private static string MetaTag(string attribute, string name, string content) => $"<meta {attribute}=\"{name}\" content=\"{Encode(content)}\">";

    private static Regex Meta(string attribute, string name) => new($"<meta\\s+{attribute}=\"{Regex.Escape(name)}\"[^>]*>", RegexOptions.IgnoreCase);

    [GeneratedRegex("<title>[^<]*</title>", RegexOptions.IgnoreCase)]
    private static partial Regex Title();
}
