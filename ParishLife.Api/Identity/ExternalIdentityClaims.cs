// Purpose: turns one provider round trip (userinfo, plus Microsoft's ID token from the token endpoint) into the claims the external
// sign-in service may use: the stable subject always, a display name, and an email only when the provider vouches that it is verified.
// Main functions: Apply (adds the claims), VerifiedEmail (the per-provider rule), ReadIdToken (decodes and checks an ID token received
// directly from the token endpoint). Constants: VerifiedEmailClaim, DisplayNameClaim, ConsumerTenant.
// Rules: Google counts an email only with email_verified true. Microsoft says not to trust its email claim, so its email counts only for
// a personal Microsoft account (tid = the consumer tenant) or when the ID token's optional claim xms_edov (domain owner verified) is true.

using System.Net.Mail;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace ParishLife.Api.Identity;

public static class ExternalIdentityClaims
{
    public const string VerifiedEmailClaim = "parishlife:external_verified_email";
    public const string DisplayNameClaim = "parishlife:external_display_name";

    // The tenant of every personal Microsoft account (Outlook.com, Hotmail, Live): Microsoft itself verified those addresses.
    public const string ConsumerTenant = "9188040d-6c67-4c5b-b112-36a304b66dad";

    private static readonly TimeSpan Skew = TimeSpan.FromMinutes(5);

    // Adds the display name and, when the provider's rule allows it, the verified email. The subject is mapped by the claim actions.
    public static void Apply(ClaimsIdentity identity, string provider, JsonElement userinfo, string? idToken, string clientId, DateTimeOffset now)
    {
        var token = provider == "microsoft" ? ReadIdToken(idToken, clientId, now) : null;
        var name = Text(userinfo, "name") ?? (token is { } t ? Text(t, "name") : null);
        if (!string.IsNullOrWhiteSpace(name))
            identity.AddClaim(new Claim(DisplayNameClaim, name.Trim()));
        if (VerifiedEmail(provider, userinfo, token) is { } email)
            identity.AddClaim(new Claim(VerifiedEmailClaim, email));
    }

    // The email this provider vouches for, or null. A Microsoft ID token must belong to the same subject as the userinfo answer.
    public static string? VerifiedEmail(string provider, JsonElement userinfo, JsonElement? idToken)
    {
        string? email;
        switch (provider)
        {
            case "google":
                email = Flag(userinfo, "email_verified") ? Text(userinfo, "email") : null;
                break;
            case "microsoft":
                if (idToken is not { } token || Text(token, "sub") is not { } sub || sub != Text(userinfo, "sub"))
                    return null;
                var personal = string.Equals(Text(token, "tid"), ConsumerTenant, StringComparison.OrdinalIgnoreCase);
                email = personal || Flag(token, "xms_edov") ? Text(token, "email") ?? Text(userinfo, "email") : null;
                break;
            default:
                return null;
        }
        return email is not null && email.Length <= 254 && MailAddress.TryCreate(email, out var parsed) && parsed.Address == email ? email : null;
    }

    // An ID token that came straight from the provider's token endpoint over TLS, in the back channel, authenticated by this client:
    // OpenID Connect Core 3.1.3.7 (6) lets TLS server validation stand in for the signature check here (the token endpoint is the fixed
    // https constant in ExternalProviderOptions, called by the code-flow back channel with PKCE). The audience and azp, the issuer of the
    // token's own tenant, expiry and not-before are still checked; anything malformed or not for this client is treated as no ID token (so
    // no verified email). No nonce is sent in the authorization request, so none is expected (3.1.3.7 (11)); state and PKCE bind the round
    // trip. The ID token never identifies the account: sign-in matches only the userinfo sub (hashed with the provider), never an email.
    public static JsonElement? ReadIdToken(string? idToken, string clientId, DateTimeOffset now)
    {
        var parts = idToken?.Split('.');
        if (parts is not { Length: 3 } || parts[1].Length is 0 or > 16384)
            return null;
        try
        {
            var padded = parts[1].Replace('-', '+').Replace('_', '/');
            padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
            using var document = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(padded)));
            var payload = document.RootElement.Clone();
            if (payload.ValueKind != JsonValueKind.Object || !Audience(payload, clientId))
                return null;
            var tenant = Text(payload, "tid");
            if (tenant is null || Text(payload, "iss") != $"https://login.microsoftonline.com/{tenant}/v2.0")
                return null;
            if (!payload.TryGetProperty("exp", out var exp) || !exp.TryGetInt64(out var seconds) || DateTimeOffset.FromUnixTimeSeconds(seconds) < now - Skew)
                return null;
            // Not yet valid (nbf in the future) is refused like an expired token.
            if (payload.TryGetProperty("nbf", out var nbf) && (!nbf.TryGetInt64(out var notBefore) || DateTimeOffset.FromUnixTimeSeconds(notBefore) > now + Skew))
                return null;
            return payload;
        }
        catch (Exception error) when (error is FormatException or JsonException or ArgumentException)
        {
            return null;
        }
    }

    private static bool Audience(JsonElement payload, string clientId)
    {
        if (!payload.TryGetProperty("aud", out var aud))
            return false;
        // OIDC Core 3.1.3.7 (3)-(5): this client among the audiences; with several audiences azp must name this client; azp, when
        // present, must always be this client.
        var azp = payload.TryGetProperty("azp", out var party) ? party : (JsonElement?)null;
        if (azp is { } given && (given.ValueKind != JsonValueKind.String || given.GetString() != clientId))
            return false;
        if (aud.ValueKind == JsonValueKind.String)
            return aud.GetString() == clientId;
        if (aud.ValueKind != JsonValueKind.Array)
            return false;
        var audiences = aud.EnumerateArray().Select(item => item.ValueKind == JsonValueKind.String ? item.GetString() : null).ToArray();
        return audiences.Contains(clientId) && (audiences.Length == 1 || azp is not null);
    }

    private static string? Text(JsonElement element, string name)
        => element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString() : null;

    // Providers send booleans as JSON true or, in some token formats, as "true"/"1"/1.
    private static bool Flag(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var value))
            return false;
        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.String => value.GetString() is "true" or "True" or "1",
            JsonValueKind.Number => value.TryGetInt32(out var number) && number == 1,
            _ => false
        };
    }
}
