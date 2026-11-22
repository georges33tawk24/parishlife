// Purpose: fixture-only helpers for tests that must reach the real HTTP server (Kestrel) rather than the in-memory test server: request
// framing and early body-size refusal are decided by Kestrel's parser, which the test server does not run.
// Main functions: Kestrel (the API on a free loopback port, X-Forwarded-Proto trusted as from the front end), SendAsync (writes raw bytes,
// optionally only the first part, and returns whatever the server answers before it closes or the wait ends), Count (responses in an answer).

using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Configuration;
using Xunit;

namespace ParishLife.IntegrationTests.Support;

internal static class RawHttp
{
    public static ConfiguredApiFactory Kestrel(string directory, out Uri server)
    {
        var factory = new ConfiguredApiFactory(directory, new() { ["ForwardedHeaders:Enabled"] = "true" }, _ => { });
        factory.UseKestrel(options => options.Listen(IPAddress.Loopback, 0));
        factory.StartServer();
        Assert.Equal(directory, factory.Services.GetRequiredService<StorageOptions>().LocalPath);
        server = new Uri(factory.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single());
        return factory;
    }

    public static async Task<string> SendAsync(Uri server, string request, int sendBytes = int.MaxValue, int waitMs = 3000)
    {
        using var tcp = new TcpClient();
        await tcp.ConnectAsync(server.Host, server.Port);
        var stream = tcp.GetStream();
        var bytes = Encoding.ASCII.GetBytes(request);
        await stream.WriteAsync(bytes.AsMemory(0, Math.Min(sendBytes, bytes.Length)));
        var all = new MemoryStream();
        var buffer = new byte[16384];
        using var timeout = new CancellationTokenSource(waitMs);
        try
        {
            int read;
            while ((read = await stream.ReadAsync(buffer, timeout.Token)) > 0)
                all.Write(buffer, 0, read);
        }
        catch (Exception error) when (error is OperationCanceledException or IOException)
        {
        }
        return Encoding.ASCII.GetString(all.ToArray());
    }

    public static int Count(string raw) => raw.Split("HTTP/1.1 ").Length - 1;
}
