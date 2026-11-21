// Purpose: marks a public authentication endpoint that must pass Turnstile verification when Turnstile is configured.
// Main function: OnActionExecutionAsync verifies the X-Turnstile-Token header, or for a browser form post (external sign-in) the
// turnstileToken form field (400 on failure, 503 fail-closed when the verifier cannot be reached); unconfigured deployments are unchanged.
// A browser form post that asked to come back to the portal (returnTo=portal) is sent back to the fixed portal page with a status word
// (check-failed or check-unavailable) instead, so the person sees the sign-in screen rather than a bare JSON answer.

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using ParishLife.Api.Controllers.Accounts;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Authorization;

[AttributeUsage(AttributeTargets.Method)]
public class TurnstileProtectedAttribute : Attribute, IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var verifier = context.HttpContext.RequestServices.GetRequiredService<TurnstileVerifier>();
        if (verifier.Enabled)
        {
            var request = context.HttpContext.Request;
            var form = request.HasFormContentType ? await request.ReadFormAsync(context.HttpContext.RequestAborted) : null;
            var token = request.Headers[TurnstileVerifier.Header].ToString();
            // A browser form post cannot carry a header; the token then travels as a form field of the same post.
            if (string.IsNullOrEmpty(token) && form is not null)
                token = form[TurnstileVerifier.FormField].ToString();
            var outcome = await verifier.VerifyAsync(token,
                context.HttpContext.Connection.RemoteIpAddress?.ToString(), context.HttpContext.RequestAborted);
            if (outcome != "Passed")
            {
                var unavailable = outcome == "Unavailable";
                SecurityEvents.Log(context.HttpContext, "security.turnstile_failed", detail: outcome);
                if (form is not null && form["returnTo"].ToString() == "portal")
                {
                    // The fixed portal page only, never a caller-chosen address; nothing secret goes into it.
                    context.Result = new RedirectResult(ExternalSignInController.PortalPage + (unavailable ? "check-unavailable" : "check-failed"));
                    return;
                }
                context.Result = new ObjectResult(new ProblemDetails
                {
                    Status = unavailable ? 503 : 400,
                    Title = unavailable ? "turnstile_unavailable" : "turnstile_failed",
                    Detail = unavailable ? "Bot verification is temporarily unavailable. Try again later." : "Complete the bot verification and try again."
                })
                { StatusCode = unavailable ? 503 : 400 };
                return;
            }
        }
        await next();
    }
}
