// Purpose: exposes the office cash ledger (openings, allowances, purchases, reversals, monthly closes and balances) over HTTP.
// Main functions: Open, Openings, Create, Update, Act, Entries, Close, Months and Balances delegate rules to OfficeLedgerService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Finance;

namespace ParishLife.Api.Controllers.Finance;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/office-ledger")]
public class OfficeLedgerController(OfficeLedgerService service) : ControllerBase
{
    [HttpPost("openings")]
    public async Task<ActionResult<OfficeOpeningDto>> Open(Guid parishId, OfficeOpeningDto request, CancellationToken ct)
        => Ok(await service.OpenAsync(Guard.Id(parishId), request, ct));

    [HttpGet("openings")]
    public async Task<ActionResult<IReadOnlyList<OfficeOpeningRecordDto>>> Openings(Guid parishId, CancellationToken ct)
        => Ok(await service.OpeningsAsync(Guard.Id(parishId), ct));

    [HttpPost("entries")]
    public async Task<ActionResult<OfficeEntryDto>> Create(Guid parishId, SaveOfficeEntryDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("entries/{entryId:guid}")]
    public async Task<ActionResult<OfficeEntryDto>> Update(Guid parishId, Guid entryId, SaveOfficeEntryDto request, CancellationToken ct)
        => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(entryId), request, ct));

    [HttpPost("entries/{entryId:guid}/actions")]
    public async Task<ActionResult<OfficeEntryDto>> Act(Guid parishId, Guid entryId, OfficeEntryActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(entryId), request, ct));

    [HttpGet("entries")]
    public async Task<ActionResult<IReadOnlyList<OfficeEntryDto>>> Entries(Guid parishId, CancellationToken ct, string? period = null)
        => Ok(await service.EntriesAsync(Guard.Id(parishId), period, ct));

    [HttpPost("months")]
    public async Task<ActionResult<OfficeMonthDto>> Close(Guid parishId, CloseOfficeMonthDto request, CancellationToken ct)
        => Ok(await service.CloseMonthAsync(Guard.Id(parishId), request, ct));

    [HttpGet("months")]
    public async Task<ActionResult<IReadOnlyList<OfficeMonthDto>>> Months(Guid parishId, CancellationToken ct)
        => Ok(await service.MonthsAsync(Guard.Id(parishId), ct));

    [HttpGet("balances")]
    public async Task<ActionResult<OfficeMonthDto>> Balances(Guid parishId, CancellationToken ct)
        => Ok(await service.BalancesAsync(Guard.Id(parishId), ct));
}
