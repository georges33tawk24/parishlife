// Purpose: the entry point of the test-only end-to-end host: starts the real API on https://localhost:<port> with isolated temporary
// storage and the built frontend, prepares the fixture accounts, writes a manifest for the browser tests, then waits until stdin closes.
// Main function: Main parses --port/--manifest/--dist/--turnstile-test-keys, starts Kestrel, builds the fixture, writes the manifest (with the
// test inbox path), prints "E2E READY", and deletes only its own temporary directory on exit.

using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Configuration;

namespace ParishLife.EndToEnd;

public static class EndToEndHost
{
    public static async Task<int> Main(string[] args)
    {
        var port = 7311;
        string? manifestPath = null;
        string? dist = null;
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--port") port = int.Parse(args[++i], System.Globalization.CultureInfo.InvariantCulture);
            else if (args[i] == "--manifest") manifestPath = args[++i];
            else if (args[i] == "--dist") dist = args[++i];
        }
        var turnstile = args.Contains("--turnstile-test-keys");
        if (manifestPath is null)
        {
            Console.Error.WriteLine("Usage: ParishLife.EndToEnd --manifest <file> [--port 7311] [--dist frontend/dist] [--turnstile-test-keys]");
            return 2;
        }

        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "ParishLife.slnx")))
            root = root.Parent;
        if (root is null)
            throw new InvalidOperationException("Run from inside the repository (ParishLife.slnx not found).");
        dist = Path.GetFullPath(dist ?? Path.Combine(root.FullName, "frontend", "dist"));
        if (!File.Exists(Path.Combine(dist, "index.html")))
            throw new InvalidOperationException("Build the frontend first (npm run build): " + dist);

        var dataDirectory = Path.Combine(Path.GetTempPath(), "ParishLife-E2E-" + Guid.NewGuid().ToString("N"));
        var exit = 0;
        using var stop = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };
        try
        {
            // The test inbox sits beside the manifest, in the runner's own temporary folder, and goes with it.
            var outbox = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(manifestPath))!, "outbox.jsonl");
            await using var factory = new EndToEndFactory(dataDirectory, dist, Path.Combine(root.FullName, "ParishLife.Api"), turnstile, outbox);
            factory.UseKestrel(options => options.ListenLocalhost(port, listen => listen.UseHttps()));
            factory.StartServer();
            if (factory.Services.GetRequiredService<StorageOptions>().LocalPath != dataDirectory)
                throw new InvalidOperationException("The host did not use the isolated storage directory.");

            await using (var scope = factory.Services.CreateAsyncScope())
            {
                var manifest = await new EndToEndFixture(scope.ServiceProvider).BuildAsync(stop.Token);
                manifest["baseUrl"] = $"https://localhost:{port}";
                manifest["dataDirectory"] = dataDirectory;
                manifest["turnstile"] = turnstile;
                manifest["outbox"] = outbox;
                await File.WriteAllTextAsync(manifestPath, JsonSerializer.Serialize(manifest, new JsonSerializerOptions { WriteIndented = true }));
            }

            Console.WriteLine($"E2E READY https://localhost:{port}");
            // The runner keeps stdin open while the browser tests run and closes it to stop the host.
            var reading = Task.Run(() => { while (Console.In.ReadLine() is not null) { } });
            await Task.WhenAny(reading, Task.Delay(Timeout.Infinite, stop.Token).ContinueWith(_ => { }, TaskScheduler.Default));
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("E2E HOST FAILED: " + error);
            exit = 1;
        }
        finally
        {
            if (Path.GetFullPath(dataDirectory).StartsWith(Path.GetFullPath(Path.GetTempPath()), StringComparison.OrdinalIgnoreCase)
                && Path.GetFileName(dataDirectory).StartsWith("ParishLife-E2E-", StringComparison.Ordinal) && Directory.Exists(dataDirectory))
                Directory.Delete(dataDirectory, true);
        }
        return exit;
    }
}
