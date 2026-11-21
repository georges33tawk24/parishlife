// Purpose: structured security events for monitoring and alerting (Part B 7 of the hardening run): one warning per event with the event
// name, the account id when known, the client address (taken from the one trusted forwarded hop, see Program.cs) and a short code.
// Never a password, code, token, email or request body. Event names: security.sign_in_failed, security.mfa_failed,
// security.rate_limited, security.csrf_rejected, security.permission_denied, security.turnstile_failed,
// security.password_reset_requested, security.password_reset_completed, security.account_closed.
// Main function: Log.

using System.Security.Claims;

namespace ParishLife.Api.Authorization;

public static class SecurityEvents
{
    public const string Category = "ParishLife.Security";

    public static void Log(HttpContext context, string name, string? accountId = null, string? detail = null)
    {
        var logger = context.RequestServices.GetService<ILoggerFactory>()?.CreateLogger(Category);
        logger?.LogWarning("Security event {SecurityEvent} account {AccountId} client {ClientAddress} path {Path} detail {Detail}", name,
            accountId ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous",
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown", context.Request.Path.Value ?? string.Empty, detail ?? string.Empty);
    }
}
