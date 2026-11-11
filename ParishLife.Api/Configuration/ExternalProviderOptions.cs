// Purpose: optional OAuth client settings for one external sign-in provider; the provider exists only when both values are set.
// Main members: ClientId, ClientSecret (private; App Service/Key Vault reference only), Configured, and the known provider table
// (Providers) with each provider's documented public OAuth/userinfo endpoints.

namespace ParishLife.Api.Configuration;

public class ExternalProviderOptions
{
    public const string SchemePrefix = "external-";

    // Public, documented provider endpoints (not credentials): authorization, token and OpenID userinfo.
    public static readonly IReadOnlyDictionary<string, string[]> Providers = new Dictionary<string, string[]>
    {
        ["google"] = ["https://accounts.google.com/o/oauth2/v2/auth", "https://oauth2.googleapis.com/token", "https://openidconnect.googleapis.com/v1/userinfo"],
        ["microsoft"] = ["https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "https://login.microsoftonline.com/common/oauth2/v2.0/token", "https://graph.microsoft.com/oidc/userinfo"]
    };

    public string? ClientId { get; set; }

    public string? ClientSecret { get; set; }

    public bool Configured => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);
}
