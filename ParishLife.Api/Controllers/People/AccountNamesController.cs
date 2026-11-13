// Purpose: exposes the shared account-name lookup that screens use to show people's names instead of account ids.
// Main functions: List (GET api/parishes/{parishId}/account-names?ids=a,b, at most 100 ids) delegates the visibility rules to
// AccountNamesService and returns only the names the caller may see.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/account-names")]
public class AccountNamesController(AccountNamesService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AccountNameDto>>> List(Guid parishId, [FromQuery] string? ids, CancellationToken ct)
        => Ok(await service.ListAsync(Guard.Id(parishId), ids, ct));
}
