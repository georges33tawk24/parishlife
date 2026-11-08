// Purpose: Maps expected failures to safe ProblemDetails and logs non-sensitive support correlation for unexpected
// failures.
// Main functions: TryHandleAsync.

using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Middleware;

internal sealed class ApiExceptionHandler(IProblemDetailsService problems, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
            return false;
        var error = exception as DomainException;
        var status = error?.Kind switch
        {
            FailureKind.Validation => StatusCodes.Status400BadRequest,
            FailureKind.NotFound => StatusCodes.Status404NotFound,
            FailureKind.Forbidden => StatusCodes.Status403Forbidden,
            FailureKind.Conflict => StatusCodes.Status409Conflict,
            FailureKind.Unavailable => StatusCodes.Status503ServiceUnavailable,
            _ => StatusCodes.Status500InternalServerError
        };
        if (error is null)
            logger.LogError("Unhandled API failure {FailureType}; correlation {CorrelationId}", exception.GetType().Name, context.TraceIdentifier);
        context.Response.StatusCode = status;
        context.Response.Headers.CacheControl = "no-store";
        return await problems.TryWriteAsync(new() { HttpContext = context, ProblemDetails = new ProblemDetails { Status = status, Title = error?.Code ?? "unexpected_failure", Detail = error?.Message ?? "The operation could not be confirmed. Check its outcome before retrying.", Extensions = { ["traceId"] = context.TraceIdentifier } } });
    }
}
