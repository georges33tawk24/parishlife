// Purpose: HTTP endpoints for a person's own data copy and account closure (privacy page promises; Part B 20 of the hardening run).
// Main functions: Data (downloads the copy as a JSON file) and Close (closes the account, then clears this browser's cookie).
// Both are personal-capacity only; recovery sessions are refused by RecoverySessionMiddleware (neither is AllowRecoverySession).

using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.Authorization;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Route("api/auth/account")]
[Authorize, EnableRateLimiting("authentication")]
public class AccountClosureController(AccountClosureService closure, SignInManager<ParishUser> signIn) : ControllerBase
{
    private static readonly JsonSerializerOptions Indented = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    [HttpGet("data")]
    public async Task<IActionResult> Data(CancellationToken ct)
    {
        var export = await closure.ExportAsync(ct);
        return File(JsonSerializer.SerializeToUtf8Bytes(export, Indented), "application/json", $"parishlife-my-data-{export.ExportedAt:yyyy-MM-dd}.json");
    }

    [HttpPost("close")]
    public async Task<ActionResult<AccountClosureDto>> Close(CloseAccountDto request, CancellationToken ct)
    {
        var result = await closure.CloseAsync(request, ct);
        SecurityEvents.Log(HttpContext, "security.account_closed");
        await signIn.SignOutAsync();
        return Ok(result);
    }
}
