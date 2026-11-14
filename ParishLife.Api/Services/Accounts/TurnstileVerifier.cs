// Purpose: verifies a client Turnstile token server-side with the configured secret; a no-op when Turnstile is not configured.
// Main function: VerifyAsync returns Passed, Failed or Unavailable; the secret and token are never logged or stored. Header and FormField name where a token travels.

using System.Text.Json;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;

namespace ParishLife.Api.Services.Accounts;

public class TurnstileVerifier(IHttpClientFactory clients, IOptionsMonitor<TurnstileOptions> options, ILogger<TurnstileVerifier> logger)
{
    public const string ClientName = "Turnstile";
    public const string Header = "X-Turnstile-Token";

    public const string FormField = "turnstileToken";

    public bool Enabled => options.CurrentValue.Enabled;

    public async Task<string> VerifyAsync(string? token, string? remoteIp, CancellationToken ct)
    {
        var settings = options.CurrentValue;
        if (!settings.Enabled)
            return "NotConfigured";
        if (string.IsNullOrWhiteSpace(token) || token.Length > 2048)
            return "Failed";
        var form = new Dictionary<string, string> { ["secret"] = settings.SecretKey!, ["response"] = token };
        if (!string.IsNullOrWhiteSpace(remoteIp))
            form["remoteip"] = remoteIp;
        try
        {
            using var response = await clients.CreateClient(ClientName).PostAsync(settings.VerifyEndpoint, new FormUrlEncodedContent(form), ct);
            if (!response.IsSuccessStatusCode)
                return "Unavailable";
            using var body = JsonDocument.Parse(await response.Content.ReadAsStreamAsync(ct));
            var root = body.RootElement;
            var success = root.TryGetProperty("success", out var flag) && flag.ValueKind == JsonValueKind.True;
            if (success && !string.IsNullOrWhiteSpace(settings.ExpectedHostname)
                && (!root.TryGetProperty("hostname", out var host) || !string.Equals(host.GetString(), settings.ExpectedHostname, StringComparison.OrdinalIgnoreCase)))
                success = false;
            return success ? "Passed" : "Failed";
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException)
        {
            if (ct.IsCancellationRequested)
                throw;
            logger.LogWarning("Turnstile verification unavailable. Failure type: {FailureType}", error.GetType().Name);
            return "Unavailable";
        }
    }
}
