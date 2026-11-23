// Purpose: proves the breached-password check (owner decision, 23 November 2026) with a stand-in for the Have I Been Pwned range API, so
// no test reaches the internet.
// Main tests: a breached password is refused at sign-up with its own message, and only the first 5 hash characters are sent (padded);
// the service being down never blocks a sign-up; outside Production nothing is called unless the setting turns it on.

using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Identity;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class BreachedPasswordTests
{
    private const string Breached = "correct horse battery staple, once leaked";

    // Answers like the range API: every suffix of the asked prefix, with padding lines of count 0. It records what it was asked.
    private sealed class RangeApi(bool down = false) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            if (down)
                throw new HttpRequestException("unreachable");
            var hash = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(Breached)));
            var body = request.RequestUri!.AbsolutePath.EndsWith(hash[..5], StringComparison.Ordinal)
                ? $"0018A45C4D1DEF81644B54AB7F969B88D65:0\r\n{hash[5..]}:42\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0"
                : "0018A45C4D1DEF81644B54AB7F969B88D65:0";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) });
        }
    }

    private static object SignUp(string password) =>
        new { operationId = Guid.NewGuid(), email = $"breach-{Guid.NewGuid():N}@fixture.example", password, displayName = "Breach check", ageConfirmed = true };

    private static async Task<(HttpResponseMessage First, HttpResponseMessage Second)> SignUpTwiceAsync(RangeApi api, string? enabled)
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new() { ["PasswordBreachCheck:Enabled"] = enabled },
            services => services.AddHttpClient(BreachedPasswordValidator.ClientName).ConfigurePrimaryHttpMessageHandler(() => api));
        using var client = factory.Client();
        await Csrf(client);
        return (await client.PostAsJsonAsync("/api/auth/register", SignUp(Breached)),
            await client.PostAsJsonAsync("/api/auth/register", SignUp("a long and entirely unremarkable fixture phrase")));
    }

    [Fact]
    public async Task A_breached_password_is_refused_at_sign_up_and_only_a_padded_five_character_prefix_is_sent()
    {
        var api = new RangeApi();
        var (breached, fresh) = await SignUpTwiceAsync(api, "true");

        Assert.Equal(HttpStatusCode.BadRequest, breached.StatusCode);
        Assert.Equal("password_breached", await Title(breached));
        Assert.Equal(HttpStatusCode.Accepted, fresh.StatusCode);
        var hash = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(Breached)));
        var first = api.Requests[0];
        Assert.Equal("https://api.pwnedpasswords.com/range/" + hash[..5], first.RequestUri!.ToString());
        Assert.Equal("true", Assert.Single(first.Headers.GetValues("Add-Padding")));
        Assert.All(api.Requests, request => Assert.Equal(5, request.RequestUri!.Segments[^1].Length)); // never more of the hash
    }

    [Fact]
    public async Task The_service_being_down_never_blocks_a_sign_up()
    {
        var api = new RangeApi(down: true);
        var (breached, fresh) = await SignUpTwiceAsync(api, "true");

        Assert.Equal((HttpStatusCode.Accepted, HttpStatusCode.Accepted), (breached.StatusCode, fresh.StatusCode));
        Assert.Equal(2, api.Requests.Count);
    }

    [Fact]
    public async Task Outside_production_nothing_is_called_unless_the_setting_turns_it_on()
    {
        var api = new RangeApi();
        var (breached, _) = await SignUpTwiceAsync(api, null);

        Assert.Equal(HttpStatusCode.Accepted, breached.StatusCode);
        Assert.Empty(api.Requests);
    }
}
