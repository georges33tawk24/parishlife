// Purpose: unit regressions for the hardening run's application-security fixes (hardening/reports/03-security.md).
// Main tests: the server rich-text allow-list (RichText.Sanitize) drops script, handlers and unsafe links and leaves plain text alone;
// Microsoft ID tokens are refused when not yet valid or issued to another authorized party (ExternalIdentityClaims.ReadIdToken).

using System.Text;
using System.Text.Json;
using ParishLife.Api.Identity;
using ParishLife.Api.Services.Publishing;
using Xunit;

namespace ParishLife.UnitTests;

public class SecurityHardeningTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 21, 12, 0, 0, TimeSpan.Zero);
    private const string Client = "client-1";

    [Theory]
    [InlineData("<script>alert(1)</script><p>Hi</p>", "alert(1)<p>Hi</p>")]
    [InlineData("<img src=x onerror=alert(1)>Text", "Text")]
    [InlineData("<p onclick=\"steal()\">Hi</p>", "<p>Hi</p>")]
    [InlineData("<a href=\"javascript:alert(1)\">x</a>", "x")]
    [InlineData("<a href=\"https://example.org/?a=1&amp;b=2\" onmouseover=x>x</a>",
        "<a href=\"https://example.org/?a=1&amp;b=2\" target=\"_blank\" rel=\"noopener noreferrer\">x</a>")]
    [InlineData("<div>One</div><br/><b>two</b> &amp; <i>3 < 4</i>", "<p>One</p><br><b>two</b> &amp; <i>3 &lt; 4</i>")]
    [InlineData("<svg><a href=\"https://e.org\">y</a></svg><!-- c --><iframe src=//evil></iframe>",
        "<a href=\"https://e.org/\" target=\"_blank\" rel=\"noopener noreferrer\">y</a>")]
    [InlineData("<p title=\"a>b\"><style>p{}</style>z</p>", "<p>b&quot;&gt;p{}z</p>")]
    public void Rich_text_keeps_only_the_allow_list(string input, string expected) => Assert.Equal(expected, RichText.Sanitize(input));

    [Theory]
    [InlineData("Mass at 5 & 7, 3 < 4")]
    [InlineData("قداس الأحد الساعة ١٠")]
    public void Plain_text_is_unchanged(string text) => Assert.Equal(text, RichText.Sanitize(text));

    [Fact]
    public void Sanitizing_is_idempotent()
    {
        var once = RichText.Sanitize("<p>a<script>b</script><a href='https://e.org/x'>c</a> &lt; d</p>");
        Assert.Equal(once, RichText.Sanitize(once));
    }

    [Fact]
    public void Microsoft_id_token_refuses_not_yet_valid_tokens_and_foreign_authorized_parties()
    {
        var userinfo = JsonDocument.Parse("""{"sub":"s1","email":"p@example.org"}""").RootElement.Clone();
        string? Verified(string token) => ExternalIdentityClaims.VerifiedEmail("microsoft", userinfo, ExternalIdentityClaims.ReadIdToken(token, Client, Now));
        Assert.Null(Verified(Token(("nbf", Now.AddMinutes(10).ToUnixTimeSeconds()))));
        Assert.Equal("p@example.org", Verified(Token(("nbf", Now.AddMinutes(-1).ToUnixTimeSeconds()))));
        Assert.Null(Verified(Token(("azp", "another-client"))));
        Assert.Equal("p@example.org", Verified(Token(("azp", Client))));
        // Several audiences need azp naming this client.
        Assert.Null(Verified(Token(("aud", new[] { Client, "another-client" }))));
        Assert.Equal("p@example.org", Verified(Token(("aud", new[] { Client, "another-client" }), ("azp", Client))));
        Assert.Null(Verified(Token(("aud", new[] { "another-client" }))));
    }

    private static string Token(params (string Name, object Value)[] extra)
    {
        var tenant = ExternalIdentityClaims.ConsumerTenant;
        var claims = new Dictionary<string, object>
        {
            ["aud"] = Client, ["tid"] = tenant, ["sub"] = "s1", ["email"] = "p@example.org",
            ["iss"] = $"https://login.microsoftonline.com/{tenant}/v2.0", ["exp"] = Now.AddHours(1).ToUnixTimeSeconds()
        };
        foreach (var (name, value) in extra)
            claims[name] = value;
        return "e30." + Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(claims))).TrimEnd('=').Replace('+', '-').Replace('/', '_') + ".sig";
    }
}
