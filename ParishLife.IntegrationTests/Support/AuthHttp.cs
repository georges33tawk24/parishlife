// Purpose: shared fixture-only HTTP helpers for account-security tests (CSRF token, password/TOTP sign-in, typed reads).
// Main functions: Csrf, LoginAsync (password then authenticator when challenged), CompleteMfaAsync and PostMfaAsync (an unspent code),
// Read, PostAsync.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace ParishLife.IntegrationTests.Support;

internal static class AuthHttp
{
    public const string Password = "isolated-fixture-long-password";

    public static async Task Csrf(HttpClient client)
    {
        var result = await Read<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", result.GetProperty("token").GetString());
    }

    public static async Task LoginAsync(HttpClient client, string username, string password = Password)
    {
        await Csrf(client);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username, password });
        if (response.StatusCode == HttpStatusCode.Accepted)
            await CompleteMfaAsync(client, (await Read<JsonElement>(response)).GetProperty("challenge"));
        else
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await Csrf(client);
    }

    public static async Task CompleteMfaAsync(HttpClient client, JsonElement challenge)
        => await Read<JsonElement>(await PostMfaAsync(client, challenge));

    // Each authenticator code signs in once, so a second sign-in of the same account within one step uses a neighbouring step's code.
    public static async Task<HttpResponseMessage> PostMfaAsync(HttpClient client, JsonElement challenge)
    {
        HttpResponseMessage? response = null;
        foreach (var step in new[] { 0, 1, -1, 2 })
        {
            response = await client.PostAsJsonAsync("/api/auth/login/mfa", new
            {
                accountId = challenge.GetProperty("accountId").GetString(),
                challenge = challenge.GetProperty("challenge").GetString(),
                code = TestAuthenticator.Code(step: step)
            });
            if (response.StatusCode != HttpStatusCode.Unauthorized)
                break;
        }
        return response!;
    }

    public static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    public static async Task<string?> Title(HttpResponseMessage response)
        => (await response.Content.ReadFromJsonAsync<JsonElement>()).TryGetProperty("title", out var title) ? title.GetString() : null;
}
