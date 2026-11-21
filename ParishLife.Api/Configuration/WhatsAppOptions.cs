// Purpose: settings for WhatsApp messages through Meta's WhatsApp Cloud API (graph.facebook.com).
// Main members: PhoneNumberId (the sending business number's ID), AccessToken (a system-user token; private, App Service Key Vault
// reference only), ApiVersion, the two message templates the owner has approved in WhatsApp Manager (NoticeTemplate: one body
// parameter, the notice text; CodeTemplate: Meta's authentication template with the code), and Configured.

namespace ParishLife.Api.Configuration;

public class WhatsAppOptions
{
    public string? PhoneNumberId { get; set; }

    public string? AccessToken { get; set; }

    public string ApiVersion { get; set; } = "v23.0";

    public string NoticeTemplate { get; set; } = "parishlife_notice";

    public string CodeTemplate { get; set; } = "parishlife_code";

    public bool Configured => !string.IsNullOrWhiteSpace(PhoneNumberId) && !string.IsNullOrWhiteSpace(AccessToken);
}
