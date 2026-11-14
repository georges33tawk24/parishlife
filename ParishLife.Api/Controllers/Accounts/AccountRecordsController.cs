// Purpose: exposes "My parish records": the signed-in account's own linked Person in each parish, with its own corrections.
// Main function: Records delegates to AccountRecordsService. Corrections go through POST /api/parishes/{id}/profile-corrections.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Accounts.Records;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Authorize]
[Route("api/account/records")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class AccountRecordsController(AccountRecordsService records) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AccountParishRecordDto>>> Records(CancellationToken ct) => Ok(await records.RecordsAsync(ct));
}
