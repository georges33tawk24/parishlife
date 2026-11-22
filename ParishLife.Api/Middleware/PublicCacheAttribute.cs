// Purpose: marks an anonymous public read as safe to cache (X11). Every other /api response stays Cache-Control: no-store (Program.cs).
// For a successful GET it sets "public, max-age" and a strong ETag hashed from the serialized response, and answers a matching If-None-Match
// with 304 so offline/stale copies can be revalidated cheaply. The serialized answer is also kept in the server's PublicReadCache, keyed by
// the exact path and query string only (no header or cookie is read, so nothing unkeyed can vary it), and later requests are answered from
// it without running the action until a public document changes. Never put it on an action that reads the caller's identity or private data.
// Main members: MaxAgeSeconds, OnResourceExecutionAsync (answers from the server cache) and OnResultExecutionAsync (ETag, 304, fills it).

using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using ParishLife.Api.Data.Cosmos;

namespace ParishLife.Api.Middleware;

[AttributeUsage(AttributeTargets.Method)]
public sealed class PublicCacheAttribute(int maxAgeSeconds = 300) : Attribute, IAsyncResourceFilter, IAsyncResultFilter
{
    private const string GenerationItem = "ParishLife.PublicCache.Generation";

    public int MaxAgeSeconds { get; } = maxAgeSeconds;

    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var http = context.HttpContext;
        if (HttpMethods.IsGet(http.Request.Method))
        {
            var cache = Cache(http);
            if (cache.TryGet(Key(http.Request), Now(http), out var entry))
            {
                context.Result = Revalidated(http, entry.ETag) ? new StatusCodeResult(StatusCodes.Status304NotModified) : new FileContentResult(entry.Body, entry.ContentType);
                return;
            }
            http.Items[GenerationItem] = cache.Generation; // read before the action, so a commit during it keeps its answer out
        }
        await next();
    }

    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        var http = context.HttpContext;
        byte[]? body = null;
        string? tag = null;
        if (HttpMethods.IsGet(http.Request.Method) && context.Result is ObjectResult { Value: not null } result && result.StatusCode is null or 200)
        {
            var json = http.RequestServices.GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions;
            body = JsonSerializer.SerializeToUtf8Bytes(result.Value, result.Value.GetType(), json);
            tag = "\"" + Convert.ToHexString(SHA256.HashData(body))[..32] + "\"";
            if (Revalidated(http, tag))
                context.Result = new StatusCodeResult(StatusCodes.Status304NotModified);
        }
        await next();
        if (body is not null && http.Response.StatusCode == StatusCodes.Status200OK && http.Response.ContentType is { } type && http.Items[GenerationItem] is long generation)
            Cache(http).Set(Key(http.Request), new PublicReadCache.Entry(body, type, tag!, generation, Now(http) + PublicReadCache.Lifetime));
    }

    // Sets the public caching headers and says whether the client's copy is current.
    private bool Revalidated(HttpContext http, string tag)
    {
        http.Response.Headers.CacheControl = "public, max-age=" + MaxAgeSeconds;
        http.Response.Headers.ETag = tag;
        return http.Request.Headers.IfNoneMatch.Any(value => value is not null && value.Split(',').Any(v => v.Trim() == tag || v.Trim() == "*"));
    }

    private static PublicReadCache Cache(HttpContext http) => PublicReadCache.For(http.RequestServices.GetRequiredService<IDocumentDatabase>());

    private static string Key(HttpRequest request) => request.Path.Value + request.QueryString.Value;

    private static DateTimeOffset Now(HttpContext http) => http.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow();
}
