// Purpose: exposes only the authenticated holder's personal profile and appearance, with ordinary cookie/CSRF protections.
// Main functions: Get reads safe state; Update saves a conditional profile; Preview derives colors without writing; ResetAppearance resets appearance only.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Accounts.Profile;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Authorize]
[Route("api/auth/profile")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AccountProfileController(AccountProfileService profiles) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Versioned<AccountProfileDto>>> Get(CancellationToken ct) => Ok(await profiles.GetAsync(ct));

    [HttpPut]
    public async Task<ActionResult<AccountProfileResultDto>> Update(UpdateAccountProfileDto request, CancellationToken ct) => Ok(await profiles.UpdateAsync(request, ct));

    [HttpPost("appearance/preview")]
    public async Task<ActionResult<AccountAppearancePreviewDto>> Preview(AccountAppearanceDto request, CancellationToken ct) => Ok(await profiles.PreviewAsync(request, ct));

    [HttpPost("appearance/reset")]
    public async Task<ActionResult<AccountProfileResultDto>> ResetAppearance(ResetAccountAppearanceDto request, CancellationToken ct) => Ok(await profiles.ResetAppearanceAsync(request, ct));
}
