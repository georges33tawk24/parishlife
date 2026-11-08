// Purpose: Requires anti-forgery validation on unsafe API requests before business mutations run.
// Main functions: OnAuthorizationAsync.

using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ParishLife.Api.Authorization;
// API-only MVC does not register the view-feature antiforgery filter.
// Use the framework antiforgery validator without adding Razor/views.
internal sealed class ValidateCsrfFilter(IAntiforgery antiforgery) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var method = context.HttpContext.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method))
            return;
        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            context.Result = new BadRequestObjectResult(new ProblemDetails { Status = 400, Title = "csrf_invalid", Detail = "Obtain a current antiforgery token and send it with this request." });
        }
    }
}
