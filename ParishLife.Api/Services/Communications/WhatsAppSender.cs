// Purpose: sends WhatsApp template messages through Meta's WhatsApp Cloud API (POST graph.facebook.com/{version}/{phone number id}/messages).
// Business-started WhatsApp messages must use templates the owner approved in WhatsApp Manager, in English ("en") and Arabic ("ar").
// Main members: ClientName, Configured, SendNoticeAsync (NoticeTemplate, one body parameter: the notice text), SendCodeAsync (CodeTemplate,
// Meta's authentication template: the code as body parameter and copy-code button), Clean (WhatsApp parameter rules). The token, the number
// and the text are never logged; failures log only the HTTP status or the error type.

using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;

namespace ParishLife.Api.Services.Communications;

public partial class WhatsAppSender(IHttpClientFactory clients, IOptions<WhatsAppOptions> options, ILogger<WhatsAppSender> logger)
{
    public const string ClientName = "WhatsApp";

    public bool Configured => options.Value.Configured;

    public Task<bool> SendNoticeAsync(string phone, string text, string language, CancellationToken ct)
        => SendAsync(phone, options.Value.NoticeTemplate, language, [new { type = "body", parameters = new[] { new { type = "text", text = Clean(text) } } }], ct);

    public Task<bool> SendCodeAsync(string phone, string code, string language, CancellationToken ct)
        => SendAsync(phone, options.Value.CodeTemplate, language,
        [
            new { type = "body", parameters = new[] { new { type = "text", text = code } } },
            new { type = "button", sub_type = "url", index = "0", parameters = new[] { new { type = "text", text = code } } }
        ], ct);

    private async Task<bool> SendAsync(string phone, string template, string language, object[] components, CancellationToken ct)
    {
        if (!Configured)
            return false;
        var settings = options.Value;
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"https://graph.facebook.com/{Uri.EscapeDataString(settings.ApiVersion)}/{Uri.EscapeDataString(settings.PhoneNumberId!)}/messages")
        {
            Content = JsonContent.Create(new
            {
                messaging_product = "whatsapp", recipient_type = "individual", to = phone.TrimStart('+'), type = "template",
                template = new { name = template, language = new { code = language == "ar" ? "ar" : "en" }, components }
            })
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.AccessToken);
        try
        {
            using var response = await clients.CreateClient(ClientName).SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
                return true;
            logger.LogWarning("WhatsApp refused a message ({Status}).", (int)response.StatusCode);
            return false;
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning("WhatsApp could not be reached ({Error}).", error.GetType().Name);
            return false;
        }
    }

    // WhatsApp refuses template parameters with new lines, tabs or more than four spaces in a row; keep it short.
    internal static string Clean(string text)
    {
        var flat = Spaces().Replace(text.Replace('\n', ' ').Replace('\r', ' ').Replace('\t', ' '), " ").Trim();
        return flat.Length > 300 ? flat[..297] + "…" : flat;
    }

    [GeneratedRegex(" {2,}")]
    private static partial Regex Spaces();
}
