// Purpose: platform-operator lists of parishes, archdioceses and sign-in accounts, plus one account's safe view and status changes.
// Main functions: Parishes, Archdioceses, Accounts, Account, Suspend, Reinstate and StatusHistory delegate MFA operator authority,
// audit, versions and the no-credential projections to PlatformDirectoryService and AccountStatusService. Recovery sessions are refused.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Administration;

namespace ParishLife.Api.Controllers.Administration;

[Authorize, ApiController, Route("api/administration")]
public class PlatformDirectoryController(PlatformDirectoryService directory, AccountStatusService status) : ControllerBase
{
    [HttpGet("parishes")]
    public async Task<ActionResult<Page<ParishDto>>> Parishes(CancellationToken ct, string? q = null, string? status = null, int size = 50, string? cursor = null)
        => Ok(await directory.ParishesAsync(q, status, size, cursor, ct));

    [HttpGet("archdioceses")]
    public async Task<ActionResult<Page<ArchdioceseDto>>> Archdioceses(CancellationToken ct, string? q = null, int size = 50, string? cursor = null)
        => Ok(await directory.ArchdiocesesAsync(q, size, cursor, ct));

    [HttpGet("accounts")]
    public async Task<ActionResult<Page<Versioned<PlatformAccountDto>>>> Accounts(CancellationToken ct, string? q = null, string? status = null, int size = 50, string? cursor = null)
        => Ok(await directory.AccountsAsync(q, status, size, cursor, ct));

    [HttpGet("accounts/{accountId:guid}")]
    public async Task<ActionResult<Versioned<PlatformAccountDto>>> Account(Guid accountId, CancellationToken ct)
        => Ok(await directory.AccountAsync(Guard.Id(accountId), ct));

    [HttpPost("accounts/{accountId:guid}/suspend")]
    public async Task<ActionResult<AccountStatusChangeDto>> Suspend(Guid accountId, AccountStatusActionDto request, CancellationToken ct)
        => Ok(await status.SuspendAsync(Guard.Id(accountId), request, ct));

    [HttpPost("accounts/{accountId:guid}/reinstate")]
    public async Task<ActionResult<AccountStatusChangeDto>> Reinstate(Guid accountId, AccountStatusActionDto request, CancellationToken ct)
        => Ok(await status.ReinstateAsync(Guard.Id(accountId), request, ct));

    [HttpGet("accounts/{accountId:guid}/status-history")]
    public async Task<ActionResult<Page<AccountStatusChangeDto>>> StatusHistory(Guid accountId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await status.HistoryAsync(Guard.Id(accountId), size, cursor, ct));
}
