// Purpose: proves that built scripts go out as the build's own Brotli or gzip copy when the browser accepts it (24 November 2026: a third
// fewer bytes than compressing on the fly), with the original type, the year-long cache and Vary: Accept-Encoding.
// Main tests: Brotli is preferred, gzip is used when Brotli is refused or not offered, and a browser that accepts neither gets the plain file.

using System.Net.Http.Headers;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PrecompressedAssetsTests
{
    [Fact]
    public async Task Scripts_go_out_as_the_builds_brotli_or_gzip_copy_when_accepted()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var web = Path.Combine(f.DirectoryPath, "web");
        var app = Path.Combine(web, "assets", "app");
        Directory.CreateDirectory(app);
        await File.WriteAllTextAsync(Path.Combine(web, "index.html"), "<!doctype html><html><head><title>Sign in</title></head><body></body></html>");
        byte[] plain = "console.log('plain')"u8.ToArray(), br = [0xB1, 0x0B, 0x01], gz = [0x1F, 0x8B, 0x08];
        await File.WriteAllBytesAsync(Path.Combine(app, "main-abc.js"), plain);
        await File.WriteAllBytesAsync(Path.Combine(app, "main-abc.js.br"), br);
        await File.WriteAllBytesAsync(Path.Combine(app, "main-abc.js.gz"), gz);
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["webroot"] = web }, _ => { });
        using var client = factory.Client();

        async Task<(byte[] Body, string? Encoding, HttpResponseMessage Response)> GetAsync(string? accept)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/assets/app/main-abc.js");
            if (accept is not null)
                request.Headers.TryAddWithoutValidation("Accept-Encoding", accept);
            var response = await client.SendAsync(request);
            return (await response.Content.ReadAsByteArrayAsync(), response.Content.Headers.ContentEncoding.SingleOrDefault(), response);
        }

        var brotli = await GetAsync("gzip, deflate, br, zstd");
        Assert.Equal(br, brotli.Body);
        Assert.Equal("br", brotli.Encoding);
        Assert.Equal("text/javascript", brotli.Response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("public, max-age=31536000, immutable", brotli.Response.Headers.CacheControl!.ToString());
        Assert.Contains("Accept-Encoding", brotli.Response.Headers.Vary);

        var gzip = await GetAsync("br;q=0, gzip");
        Assert.Equal(gz, gzip.Body);
        Assert.Equal("gzip", gzip.Encoding);
        var gzipOnly = await GetAsync("gzip");
        Assert.Equal(gz, gzipOnly.Body);
        Assert.Equal("gzip", gzipOnly.Encoding);

        var none = await GetAsync(null);
        Assert.Equal(plain, none.Body);
        Assert.Null(none.Encoding);
        Assert.Equal("text/javascript", none.Response.Content.Headers.ContentType!.MediaType);
    }
}
