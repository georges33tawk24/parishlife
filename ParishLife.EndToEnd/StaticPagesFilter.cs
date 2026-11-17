// Purpose: serves the built frontend (frontend/dist) ahead of the API pipeline in the test-only host, so pages and /api share one origin.
// Main function: Configure adds default-file and static-file middleware over the dist folder; /api and /health still reach the API.

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;

namespace ParishLife.EndToEnd;

public class StaticPagesFilter(string distDirectory) : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        var files = new PhysicalFileProvider(distDirectory);
        app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files });
        app.UseStaticFiles(new StaticFileOptions { FileProvider = files, ServeUnknownFileTypes = false });
        next(app);
    };
}
