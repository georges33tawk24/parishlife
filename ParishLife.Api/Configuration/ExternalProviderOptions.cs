// Purpose: optional OAuth client settings for one external sign-in provider; the provider exists only when it is configured.
// Main members: ClientId, ClientSecret (private; App Service/Key Vault reference only), UseManagedIdentityAssertion (Microsoft only:
// the client proves itself with a token of the app's user-assigned managed identity instead of a secret), IsConfigured, the sign-in
// Scopes, the known provider table (Providers) with each provider's documented public OAuth/userinfo endpoints, and
// ConfigurationProblem (startup check: a client ID without its secret, or a secret without its client ID, or an unresolved Key Vault reference).

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

    // openid for the subject; email and profile so sign-up can read a verified email and a display name.
    public static readonly string[] Scopes = ["openid", "email", "profile"];

    public string? ClientId { get; set; }

    public string? ClientSecret { get; set; }

    public bool UseManagedIdentityAssertion { get; set; } = false;

    // Google always needs its secret; Microsoft needs either its secret or the managed-identity assertion (which wins when both are set).
    public bool IsConfigured(string provider) => !string.IsNullOrWhiteSpace(ClientId)
        && (!string.IsNullOrWhiteSpace(ClientSecret) || provider == "microsoft" && UseManagedIdentityAssertion);

    // Null when the provider is fully configured or fully off; otherwise a message naming the setting (never its value).
    public string? ConfigurationProblem(string provider)
    {
        var anySet = !string.IsNullOrWhiteSpace(ClientId) || !string.IsNullOrWhiteSpace(ClientSecret) || UseManagedIdentityAssertion;
        if (!anySet || IsConfigured(provider) && !AzureConfiguration.IsUnresolvedKeyVaultReference(ClientSecret))
            return null;
        if (AzureConfiguration.IsUnresolvedKeyVaultReference(ClientSecret))
            return $"ExternalSignIn:{provider}:ClientSecret is an unresolved Key Vault reference; check the App Service identity's access to the secret.";
        if (UseManagedIdentityAssertion && provider != "microsoft")
            return $"ExternalSignIn:{provider}:UseManagedIdentityAssertion is supported for microsoft only.";
        return string.IsNullOrWhiteSpace(ClientId)
            ? $"ExternalSignIn:{provider}:ClientId is required when other settings for that provider are present."
            : $"ExternalSignIn:{provider} needs ClientSecret{(provider == "microsoft" ? " or UseManagedIdentityAssertion=true" : "")}.";
    }
}
