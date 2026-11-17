// Purpose: serves the built frontend (frontend/dist, published into wwwroot only with -p:IncludeFrontend=true) from the API's own origin,
// because the API's __Host- cookies are Secure and SameSite=Strict with no CORS: the pages and /api must share one HTTPS host.
// Main function: UseParishLifeFrontend adds default-file and static-file middleware when wwwroot holds index.html, with hashed assets cached
// for a year and pages revalidated on every visit; with no wwwroot (an API-only deployment) it adds nothing.

using Microsoft.AspNetCore.StaticFiles;

namespace ParishLife.Api.Extensions;

public static class FrontendHostingExtensions
{
    public static WebApplication UseParishLifeFrontend(this WebApplication app)
    {
        var root = app.Environment.WebRootPath;
        if (string.IsNullOrEmpty(root) || !File.Exists(Path.Combine(root, "index.html")))
            return app;
        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            ContentTypeProvider = new FileExtensionContentTypeProvider(),
            OnPrepareResponse = context => context.Context.Response.Headers.CacheControl =
                context.Context.Request.Path.StartsWithSegments("/assets/app") ? "public, max-age=31536000, immutable" : "no-cache"
        });
        return app;
    }
}
