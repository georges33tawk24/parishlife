// Purpose: fixture-only fakes for account-security tests: captured contact-code delivery, a routed HTTP backchannel for
// external providers/Turnstile, and an isolated API host with extra configuration and service overrides.
// Main members: CapturedContactDelivery (Configured, Sent, SendAsync), RoutedHandler (Requests, routes), ConfiguredApiFactory.

using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Interfaces.Services.Accounts;

namespace ParishLife.IntegrationTests.Support;

internal sealed class CapturedContactDelivery(bool configured = true, bool accept = true) : IContactCodeDelivery
{
    public List<(string Email, string Code, string Purpose)> Sent { get; } = [];

    public bool Configured => configured;

    public Task<bool> SendAsync(string email, string code, string purpose, CancellationToken ct)
    {
        Sent.Add((email, code, purpose));
        return Task.FromResult(accept);
    }
}

internal sealed class RoutedHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> route) : HttpMessageHandler
{
    public List<(string Uri, string Body)> Requests { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add((request.RequestUri!.ToString(), request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken)));
        return await route(request);
    }

    public static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK)
        => new(status) { Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json") };
}

internal sealed class ConfiguredApiFactory(string directory, Dictionary<string, string?> settings, Action<IServiceCollection> services)
    : LocalApiFactory(directory)
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        // Host settings are visible while Program registers services (external providers are registered only when configured).
        foreach (var (key, value) in settings)
            builder.UseSetting(key, value);
        builder.ConfigureTestServices(services);
    }
}
