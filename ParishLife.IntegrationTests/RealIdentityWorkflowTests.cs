// Purpose: exercises username/password/MFA login, authenticated cookies, and logout against real isolated local stores.
// Main test: Username_only_super_admin_can_sign_in_and_revoke_the_actual_session.
// Helpers: CsrfAsync obtains anti-forgery tokens; FixtureCode supplies a test-only TOTP, never production credentials.

using System.Buffers.Binary;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Identity;
using Xunit;

namespace ParishLife.IntegrationTests;

public sealed class RealIdentityWorkflowTests
{
    [Fact]
    public async Task Username_only_super_admin_can_sign_in_and_revoke_the_actual_session()
    {
        var directory = Path.Combine(Path.GetTempPath(), "ParishLife-HttpIdentity-" + Guid.NewGuid().ToString("N"));
        try
        {
            await using var factory = new RealIdentityFactory(directory);
            using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new("https://localhost"), HandleCookies = true, AllowAutoRedirect = false });
            Assert.Equal(directory, factory.Services.GetRequiredService<ParishLife.Api.Configuration.StorageOptions>().LocalPath);
            await using (var scope = factory.Services.CreateAsyncScope())
            {
                var bootstrap = scope.ServiceProvider.GetRequiredService<SuperAdminBootstrapService>();
                var user = await bootstrap.PrepareAsync("colinsleiman", "isolated-http-fixture-password", "isolated HTTP fixture", default);
                await bootstrap.CompleteAsync(user, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", FixtureCode(), default);
            }

            await CsrfAsync(client);
            var password = await client.PostAsJsonAsync("/api/auth/login", new { username = "colinsleiman", password = "isolated-http-fixture-password" });
            Assert.True(password.StatusCode == HttpStatusCode.Accepted, factory.LastFailure?.ToString() ?? await password.Content.ReadAsStringAsync());
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
            var pending = await password.Content.ReadFromJsonAsync<JsonElement>();
            var challenge = pending.GetProperty("challenge");
            var completionRequest = new
            {
                accountId = challenge.GetProperty("accountId").GetString(),
                challenge = challenge.GetProperty("challenge").GetString(),
                code = FixtureCode()
            };
            var completed = await client.PostAsJsonAsync("/api/auth/login/mfa", completionRequest);
            Assert.True(completed.StatusCode == HttpStatusCode.OK, factory.LastFailure?.ToString() ?? await completed.Content.ReadAsStringAsync());
            var profileResponse = await client.GetAsync("/api/auth/me");
            Assert.Equal(HttpStatusCode.OK, profileResponse.StatusCode);
            var profile = await profileResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("colinsleiman", profile.GetProperty("username").GetString());
            Assert.Equal(JsonValueKind.Null, profile.GetProperty("email").ValueKind);
            Assert.False(profile.GetProperty("emailConfirmed").GetBoolean());
            Assert.True(profile.GetProperty("accountVerified").GetBoolean());
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/openapi/v1.json")).StatusCode);
            await CsrfAsync(client); // A token from the anonymous identity must not authorize the authenticated identity.
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login/mfa", completionRequest)).StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/auth/logout", new { })).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health/ready")).StatusCode);
        }
        finally
        {
            if (Directory.Exists(directory))
                Directory.Delete(directory, recursive: true);
        }
    }

    private static async Task CsrfAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/auth/csrf");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", payload.GetProperty("token").GetString());
    }

    internal static string FixtureCode()
    {
        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30);
        var hash = HMACSHA1.HashData(new byte[20], counter);
        var offset = hash[^1] & 15;
        var value = BinaryPrimitives.ReadInt32BigEndian(hash.AsSpan(offset, 4)) & int.MaxValue;
        return (value % 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
    }

    private sealed class RealIdentityFactory(string directory) : WebApplicationFactory<Program>
    {
        internal Exception? LastFailure { get; private set; }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:Provider"] = "Local", ["Storage:LocalPath"] = directory, ["BackgroundJobs:Enabled"] = "false", ["APPLICATIONINSIGHTS_CONNECTION_STRING"] = "", ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "" }));
            builder.ConfigureTestServices(services => services.Insert(0, ServiceDescriptor.Singleton<IExceptionHandler>(new TestFailureRecorder(exception => LastFailure = exception))));
        }
    }

    private sealed class TestFailureRecorder(Action<Exception> record) : IExceptionHandler
    {
        public ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
        {
            record(exception);
            return ValueTask.FromResult(false);
        }
    }
}
