// Purpose: sends the build's maximum-strength Brotli or gzip copy of a script, style sheet or SVG under /assets (written once by
// frontend/scripts/precompress.mjs) when the browser accepts it, instead of compressing every request on the fly at the fastest, weakest
// setting. On a slow line that is a third fewer bytes for the public script (124 KB instead of 185 KB, 24 November 2026).
// Main members: UsePrecompressedAssets (points the request at the .br or .gz copy when one exists and remembers the original type), Apply
// (called from the static-file response: original type plus Content-Encoding), Accepts (reads Accept-Encoding, honouring q=0). The static
// file middleware still resolves the path inside the web root and refuses anything outside it.

using Microsoft.Net.Http.Headers;

namespace ParishLife.Api.Middleware;

internal static class PrecompressedAssets
{
    private const string Key = "ParishLife.Precompressed";
    private static readonly Dictionary<string, string> Types = new(StringComparer.OrdinalIgnoreCase)
    {
        [".js"] = "text/javascript", [".css"] = "text/css", [".svg"] = "image/svg+xml"
    };

    internal static IApplicationBuilder UsePrecompressedAssets(this IApplicationBuilder app, string root) => app.Use(async (context, next) =>
    {
        var request = context.Request;
        var path = request.Path.Value ?? string.Empty;
        if ((HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method)) && path.StartsWith("/assets/", StringComparison.Ordinal)
            && !path.Contains("..", StringComparison.Ordinal) && Types.TryGetValue(Path.GetExtension(path), out var type))
        {
            context.Response.Headers.Vary = HeaderNames.AcceptEncoding; // the same address answers differently by encoding
            var accepted = request.Headers.AcceptEncoding.ToString();
            var encoding = Accepts(accepted, "br") ? "br" : Accepts(accepted, "gzip") ? "gzip" : null;
            var copy = encoding is null ? null : path + (encoding == "br" ? ".br" : ".gz");
            if (copy is not null && File.Exists(Path.Combine(root, copy.TrimStart('/'))))
            {
                request.Path = copy;
                context.Items[Key] = (encoding, type);
            }
        }
        await next();
    });

    internal static void Apply(HttpContext context)
    {
        if (context.Items[Key] is not (string encoding, string type))
            return;
        context.Response.Headers.ContentEncoding = encoding;
        context.Response.ContentType = type;
    }

    // "gzip, deflate, br" or "br;q=0.8, gzip;q=1.0": the coding is listed and its quality is not zero.
    internal static bool Accepts(string header, string coding) => header.Split(',').Select(part => part.Trim()).Any(part =>
    {
        var pieces = part.Split(';');
        if (!pieces[0].Trim().Equals(coding, StringComparison.OrdinalIgnoreCase))
            return false;
        var q = pieces.Skip(1).Select(p => p.Trim()).FirstOrDefault(p => p.StartsWith("q=", StringComparison.OrdinalIgnoreCase));
        return q is null || !double.TryParse(q[2..], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var value) || value > 0;
    });
}
