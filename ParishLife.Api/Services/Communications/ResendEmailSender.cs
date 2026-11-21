// Purpose: sends one email through Resend's HTTPS API (POST /emails, bearer API key) for every ParishLife email: account codes, notices
// and broadcasts. Acceptance by Resend is not proof of receipt.
// Main members: ClientName (the named HttpClient), Endpoint, Configured and SendAsync (true only on a 2xx answer). The key, the recipient
// and the message are never logged; failures log only the HTTP status or the error type.

using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;

namespace ParishLife.Api.Services.Communications;

public class ResendEmailSender(IHttpClientFactory clients, IOptions<EmailOptions> options, ILogger<ResendEmailSender> logger)
{
    public const string ClientName = "Resend";
    public const string Endpoint = "https://api.resend.com/emails";

    public bool Configured => options.Value.Configured;

    public async Task<bool> SendAsync(string to, string subject, string text, string html, CancellationToken ct)
    {
        if (!Configured)
            return false;
        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
        {
            Content = JsonContent.Create(new { from = options.Value.From, to = new[] { to }, subject, text, html })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.ResendApiKey);
        try
        {
            using var response = await clients.CreateClient(ClientName).SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
                return true;
            logger.LogWarning("Resend refused an email ({Status}).", (int)response.StatusCode);
            return false;
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning("Resend could not be reached ({Error}).", error.GetType().Name);
            return false;
        }
    }
}
