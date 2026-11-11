// Purpose: marks a public authentication endpoint that must pass Turnstile verification when Turnstile is configured.
// Main function: OnActionExecutionAsync verifies the X-Turnstile-Token header (400 on failure, 503 fail-closed when the verifier
// cannot be reached); unconfigured deployments are unchanged.

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
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
            var outcome = await verifier.VerifyAsync(context.HttpContext.Request.Headers[TurnstileVerifier.Header].ToString(),
                context.HttpContext.Connection.RemoteIpAddress?.ToString(), context.HttpContext.RequestAborted);
            if (outcome != "Passed")
            {
                var unavailable = outcome == "Unavailable";
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
