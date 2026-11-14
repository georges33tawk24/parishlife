// Purpose: exposes the authenticated holder's own signature image (private; an image only, not an electronic signature).
// Main functions: Get reads it with its version; Save stores or replaces it; Remove deletes it. Rules are in AccountSignatureService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Accounts.Signature;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Authorize]
[Route("api/account/signature")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AccountSignatureController(AccountSignatureService signatures) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AccountSignatureStatusDto>> Get(CancellationToken ct) => Ok(await signatures.GetAsync(ct));

    [HttpPost]
    public async Task<ActionResult<AccountSignatureStatusDto>> Save(SaveAccountSignatureDto request, CancellationToken ct) => Ok(await signatures.SaveAsync(request, ct));

    [HttpPost("remove")]
    public async Task<ActionResult<AccountSignatureStatusDto>> Remove(RemoveAccountSignatureDto request, CancellationToken ct) => Ok(await signatures.RemoveAsync(request, ct));
}
