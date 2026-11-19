// Purpose: unit tests for the per-provider rule that decides when a provider's email counts as verified (ExternalIdentityClaims).
// Main tests: Google needs email_verified; Microsoft trusts its email only for a personal account or with xms_edov true, only from an
// ID token for this client, unexpired, with the Microsoft issuer of its own tenant and the same subject as userinfo.

using System.Text;
using System.Text.Json;
using ParishLife.Api.Identity;
using Xunit;

namespace ParishLife.UnitTests;

public class ExternalIdentityClaimsTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 19, 12, 0, 0, TimeSpan.Zero);
    private const string Client = "client-1";
    private const string Work = "11111111-2222-3333-4444-555555555555";

    [Theory]
    [InlineData("""{"sub":"a","email":"p@example.org","email_verified":true}""", "p@example.org")]
    [InlineData("""{"sub":"a","email":"p@example.org","email_verified":"true"}""", "p@example.org")]
    [InlineData("""{"sub":"a","email":"p@example.org","email_verified":false}""", null)]
    [InlineData("""{"sub":"a","email":"p@example.org"}""", null)]
    [InlineData("""{"sub":"a","email":"not an address","email_verified":true}""", null)]
    public void Google_counts_an_email_only_when_it_is_marked_verified(string userinfo, string? expected)
        => Assert.Equal(expected, ExternalIdentityClaims.VerifiedEmail("google", Json(userinfo), null));

    [Fact]
    public void Microsoft_trusts_a_personal_account_or_a_domain_owner_verified_email_only()
    {
        var userinfo = Json("""{"sub":"s1","email":"p@example.org"}""");
        Assert.Equal("p@example.org", Verified(userinfo, Token(ExternalIdentityClaims.ConsumerTenant)));
        Assert.Null(Verified(userinfo, Token(Work)));
        Assert.Equal("p@example.org", Verified(userinfo, Token(Work, extra: ("xms_edov", true))));
        Assert.Equal("p@example.org", Verified(userinfo, Token(Work, extra: ("xms_edov", "1"))));
        Assert.Null(Verified(userinfo, Token(Work, extra: ("xms_edov", false))));
        // Without an ID token there is nothing to vouch for the email, whatever userinfo says.
        Assert.Null(ExternalIdentityClaims.VerifiedEmail("microsoft", userinfo, null));
    }

    [Fact]
    public void Microsoft_id_token_must_be_for_this_client_unexpired_from_its_tenant_issuer_and_the_same_subject()
    {
        var userinfo = Json("""{"sub":"s1","email":"p@example.org"}""");
        var personal = ExternalIdentityClaims.ConsumerTenant;
        Assert.Null(Verified(userinfo, Token(personal, aud: "another-client")));
        Assert.Null(Verified(userinfo, Token(personal, exp: Now.AddMinutes(-10))));
        Assert.Null(Verified(userinfo, Token(personal, iss: "https://evil.example/v2.0")));
        Assert.Null(Verified(userinfo, Token(personal, sub: "someone-else")));
        Assert.Null(Verified(userinfo, "not-a-token"));
        Assert.Equal("p@example.org", Verified(userinfo, Token(personal, exp: Now.AddMinutes(-2)))); // within the clock skew
    }

    private static string? Verified(JsonElement userinfo, string idToken)
        => ExternalIdentityClaims.VerifiedEmail("microsoft", userinfo, ExternalIdentityClaims.ReadIdToken(idToken, Client, Now));

    private static string Token(string tenant, string aud = Client, string sub = "s1", DateTimeOffset? exp = null, string? iss = null,
        (string Name, object Value)? extra = null)
    {
        var claims = new Dictionary<string, object>
        {
            ["aud"] = aud, ["tid"] = tenant, ["sub"] = sub, ["email"] = "p@example.org",
            ["iss"] = iss ?? $"https://login.microsoftonline.com/{tenant}/v2.0", ["exp"] = (exp ?? Now.AddHours(1)).ToUnixTimeSeconds()
        };
        if (extra is { } item)
            claims[item.Name] = item.Value;
        return "e30." + Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(claims))).TrimEnd('=').Replace('+', '-').Replace('/', '_') + ".sig";
    }

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
