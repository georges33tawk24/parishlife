// Purpose: restricts recovery-code authentication to explicitly permitted account-security actions and public endpoints.
// Main function: InvokeAsync blocks regular application/administration access until a normal authenticator sign-in succeeds.

using Microsoft.AspNetCore.Authorization;
using ParishLife.Api.Authorization;

namespace ParishLife.Api.Middleware;

public class RecoverySessionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        if (context.User.Identity?.IsAuthenticated == true && context.User.HasClaim("amr", "recovery")
            && endpoint?.Metadata.GetMetadata<IAllowAnonymous>() is null
            && endpoint?.Metadata.GetMetadata<AllowRecoverySessionAttribute>() is null)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.Headers.CacheControl = "no-store";
            await Results.Problem(statusCode: 403, title: "recovery_session_restricted",
                detail: "This recovery session permits only account-security actions. Restore your authenticator before returning to regular work.").ExecuteAsync(context);
            return;
        }
        await next(context);
    }
}
