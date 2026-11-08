// Purpose: Selects the provider and resolves the separate Development document/key directory.
// Main functions: ResolveLocalPath.

namespace ParishLife.Api.Configuration;

public sealed class StorageOptions
{
    public string Provider { get; set; } = "Cosmos";
    public string LocalPath { get; set; } = "";

    public static string ResolveLocalPath(StorageOptions options, IHostEnvironment environment)
    {
        if (!string.IsNullOrWhiteSpace(options.LocalPath))
            return Path.GetFullPath(options.LocalPath, environment.ContentRootPath);
        for (var directory = new DirectoryInfo(environment.ContentRootPath); directory is not null; directory = directory.Parent)
            if (File.Exists(Path.Combine(directory.FullName, "ParishLife.slnx")))
                return Path.Combine(directory.FullName, ".parishlife-data");
        return Path.Combine(environment.ContentRootPath, ".parishlife-data");
    }
}
