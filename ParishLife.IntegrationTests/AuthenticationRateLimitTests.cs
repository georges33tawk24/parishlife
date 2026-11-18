// Purpose: verifies the sign-in rate limit boundary (owner decision, 18 November 2026): /api/auth/csrf and /api/auth/me, which the portal
// calls on every page load, do not use the strict "authentication" budget, while sign-in attempts still do.
// Main test: Page_load_calls_do_not_use_the_sign_in_budget_but_sign_in_attempts_do (isolated temporary storage, one client address).

using System.Net;
using System.Net.Http.Json;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public sealed class AuthenticationRateLimitTests
{
    [Fact]
    public async Task Page_load_calls_do_not_use_the_sign_in_budget_but_sign_in_attempts_do()
    {
        var directory = Path.Combine(Path.GetTempPath(), "ParishLife-RateLimit-" + Guid.NewGuid().ToString("N"));
        try
        {
            await using var factory = new LocalApiFactory(directory);
            using var client = factory.Client();

            // Well past the 20-a-minute sign-in budget: none of these may be refused.
            for (var i = 0; i < 30; i++)
            {
                Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/csrf")).StatusCode);
                Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
            }

            await AuthHttp.Csrf(client);
            var refused = false;
            for (var i = 0; i < 25 && !refused; i++)
            {
                var attempt = await client.PostAsJsonAsync("/api/auth/login", new { username = "nobody@fixture.example", password = "not-a-real-password-value" });
                refused = attempt.StatusCode == HttpStatusCode.TooManyRequests;
            }
            Assert.True(refused, "Sign-in attempts must still be limited by the authentication policy.");

            // The page-load calls keep working while sign-in is throttled.
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/csrf")).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        }
        finally
        {
            if (Directory.Exists(directory))
                Directory.Delete(directory, true);
        }
    }
}
