// Purpose: marks an anonymous public read as safe to cache (X11). Every other /api response stays Cache-Control: no-store (Program.cs).
// For a successful GET it sets "public, max-age" and a strong ETag hashed from the serialized response, and answers a matching If-None-Match
// with 304 so offline/stale copies can be revalidated cheaply. Never put it on an action that reads the caller's identity or private data.
// Main members: MaxAgeSeconds and OnResultExecutionAsync.

using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace ParishLife.Api.Middleware;

[AttributeUsage(AttributeTargets.Method)]
public sealed class PublicCacheAttribute(int maxAgeSeconds = 300) : Attribute, IAsyncResultFilter
{
    public int MaxAgeSeconds { get; } = maxAgeSeconds;

    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        var http = context.HttpContext;
        if (HttpMethods.IsGet(http.Request.Method) && context.Result is ObjectResult { Value: not null } result && result.StatusCode is null or 200)
        {
            var json = http.RequestServices.GetRequiredService<IOptions<JsonOptions>>().Value.JsonSerializerOptions;
            var tag = "\"" + Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(result.Value, result.Value.GetType(), json)))[..32] + "\"";
            http.Response.Headers.CacheControl = "public, max-age=" + MaxAgeSeconds;
            http.Response.Headers.ETag = tag;
            if (http.Request.Headers.IfNoneMatch.Any(value => value is not null && value.Split(',').Any(v => v.Trim() == tag || v.Trim() == "*")))
                context.Result = new StatusCodeResult(StatusCodes.Status304NotModified);
        }
        await next();
    }
}
