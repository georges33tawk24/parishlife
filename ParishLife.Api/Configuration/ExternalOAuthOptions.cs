// Purpose: OAuth handler options for one external sign-in provider, adding the managed-identity client assertion switch.
// Main members: UseManagedIdentityAssertion, AssertionScope, and Validate (without a client secret when the assertion is used).

using Microsoft.AspNetCore.Authentication.OAuth;

namespace ParishLife.Api.Configuration;

public class ExternalOAuthOptions : OAuthOptions
{
    // The audience Microsoft Entra expects on a managed-identity token used as a federated client credential (global cloud).
    public const string AssertionScope = "api://AzureADTokenExchange/.default";

    public bool UseManagedIdentityAssertion { get; set; } = false;

    public override void Validate()
    {
        if (!UseManagedIdentityAssertion)
        {
            base.Validate();
            return;
        }
        // Same checks as OAuthOptions.Validate except the client secret, which this client never has.
        if (string.IsNullOrEmpty(ClientId))
            throw new ArgumentException("The 'ClientId' option must be provided.", nameof(ClientId));
        if (string.IsNullOrEmpty(AuthorizationEndpoint))
            throw new ArgumentException("The 'AuthorizationEndpoint' option must be provided.", nameof(AuthorizationEndpoint));
        if (string.IsNullOrEmpty(TokenEndpoint))
            throw new ArgumentException("The 'TokenEndpoint' option must be provided.", nameof(TokenEndpoint));
        if (!CallbackPath.HasValue)
            throw new ArgumentException("The 'CallbackPath' option must be provided.", nameof(CallbackPath));
    }
}
