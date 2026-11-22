// Purpose: answers the API's Turnstile siteverify calls inside the test-only host, so the browser tests never depend on the internet
// (an operator test once failed when Cloudflare could not be reached). It behaves as Cloudflare documents its dummy keys: the dummy
// secret accepts only the dummy widget token and refuses anything else. Test-only; never deployed.
// Main member: SendAsync reads the posted form and returns Cloudflare's JSON shape (success, hostname or error-codes).

using System.Net;
using System.Text;

namespace ParishLife.EndToEnd;

public class OfflineTurnstileHandler : HttpMessageHandler
{
    // The token Cloudflare's dummy site keys hand the page; the browser tests' stand-in widget hands the same one.
    public const string DummyToken = "XXXX.DUMMY.TOKEN.XXXX";

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var form = System.Web.HttpUtility.ParseQueryString(request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken));
        var passed = form["secret"] == EndToEndFactory.TestSecretKey && form["response"] == DummyToken;
        var json = passed ? """{"success":true,"hostname":"localhost"}""" : """{"success":false,"error-codes":["invalid-input-response"]}""";
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    }
}
