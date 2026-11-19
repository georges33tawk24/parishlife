// Purpose: the OAuth handler for external sign-in providers. It behaves exactly like the framework handler, except that a provider
// configured with UseManagedIdentityAssertion redeems the authorization code with a client assertion (a token of the app's user-assigned
// managed identity, audience api://AzureADTokenExchange) instead of a client secret, so no Microsoft secret exists anywhere.
// Main function: ExchangeCodeAsync (the code redemption, with PKCE, as in the framework, plus client_assertion when configured).

using System.Net.Http.Headers;
using System.Text.Encodings.Web;
using System.Text.Json;
using Azure.Core;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;

namespace ParishLife.Api.Identity;

public class ExternalOAuthHandler(IOptionsMonitor<ExternalOAuthOptions> options, ILoggerFactory logger, UrlEncoder encoder, TokenCredential credential)
    : OAuthHandler<ExternalOAuthOptions>(options, logger, encoder)
{
    protected override async Task<OAuthTokenResponse> ExchangeCodeAsync(OAuthCodeExchangeContext context)
    {
        if (!Options.UseManagedIdentityAssertion)
            return await base.ExchangeCodeAsync(context);
        string assertion;
        try
        {
            // The hosted credential is the user-assigned managed identity; the app registration trusts it as a federated credential.
            assertion = (await credential.GetTokenAsync(new TokenRequestContext([ExternalOAuthOptions.AssertionScope]), Context.RequestAborted)).Token;
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            return OAuthTokenResponse.Failed(new AuthenticationFailureException("The managed identity could not provide a client assertion.", error));
        }
        var parameters = new Dictionary<string, string>
        {
            ["client_id"] = Options.ClientId,
            ["redirect_uri"] = context.RedirectUri,
            ["code"] = context.Code,
            ["grant_type"] = "authorization_code",
            ["client_assertion_type"] = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            ["client_assertion"] = assertion
        };
        if (context.Properties.Items.TryGetValue(OAuthConstants.CodeVerifierKey, out var verifier) && verifier is not null)
        {
            parameters[OAuthConstants.CodeVerifierKey] = verifier;
            context.Properties.Items.Remove(OAuthConstants.CodeVerifierKey);
        }
        using var request = new HttpRequestMessage(HttpMethod.Post, Options.TokenEndpoint) { Content = new FormUrlEncodedContent(parameters), Version = Backchannel.DefaultRequestVersion };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        using var response = await Backchannel.SendAsync(request, Context.RequestAborted);
        var body = await response.Content.ReadAsStringAsync(Context.RequestAborted);
        if (response.IsSuccessStatusCode)
            return OAuthTokenResponse.Success(JsonDocument.Parse(body));
        // The provider's error code only (no body echo): the body can name the client but never holds the assertion.
        var code = "unknown";
        try
        {
            using var error = JsonDocument.Parse(body);
            if (error.RootElement.TryGetProperty("error", out var value) && value.ValueKind == JsonValueKind.String)
                code = value.GetString()!;
        }
        catch (JsonException)
        { }
        return OAuthTokenResponse.Failed(new AuthenticationFailureException($"The token endpoint refused the code ({(int)response.StatusCode}, {code})."));
    }
}
