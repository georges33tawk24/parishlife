// Purpose: exposes ministry stock, member-visible available stock, loans, own loans and loan history over HTTP.
// Main functions: CreateStock, UpdateStock, ListStock, AvailableStock, RequestLoan, Act, Get, List, Mine and History delegate rules to MinistryResourceService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}")]
public class MinistryResourcesController(MinistryResourceService service) : ControllerBase
{
    [HttpPost("stock")]
    public async Task<ActionResult<MinistryStockDto>> CreateStock(Guid parishId, Guid ministryId, SaveStockDto request, CancellationToken ct)
        => Ok(await service.SaveStockAsync(Guard.Id(parishId), Guard.Id(ministryId), null, request, ct));

    [HttpPut("stock/{stockId:guid}")]
    public async Task<ActionResult<MinistryStockDto>> UpdateStock(Guid parishId, Guid ministryId, Guid stockId, SaveStockDto request, CancellationToken ct)
        => Ok(await service.SaveStockAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(stockId), request, ct));

    [HttpGet("stock")]
    public async Task<ActionResult<Page<Versioned<MinistryStockDto>>>> ListStock(Guid parishId, Guid ministryId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListStockAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpGet("stock/available")]
    public async Task<ActionResult<Page<Versioned<MinistryStockDto>>>> AvailableStock(Guid parishId, Guid ministryId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.AvailableStockAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpPost("loans")]
    public async Task<ActionResult<MinistryLoanDto>> RequestLoan(Guid parishId, Guid ministryId, RequestLoanDto request, CancellationToken ct)
        => Ok(await service.RequestAsync(Guard.Id(parishId), Guard.Id(ministryId), request, ct));

    [HttpGet("loans")]
    public async Task<ActionResult<Page<Versioned<MinistryLoanDto>>>> List(Guid parishId, Guid ministryId, CancellationToken ct,
        string? status = null, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), Guard.Id(ministryId), status, size, cursor, ct));

    [HttpGet("loans/mine")]
    public async Task<ActionResult<Page<Versioned<MinistryLoanDto>>>> Mine(Guid parishId, Guid ministryId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.OwnAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpGet("loans/{loanId:guid}")]
    public async Task<ActionResult<Versioned<MinistryLoanDto>>> Get(Guid parishId, Guid ministryId, Guid loanId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(loanId), ct));

    [HttpPost("loans/{loanId:guid}/actions")]
    public async Task<ActionResult<MinistryLoanDto>> Act(Guid parishId, Guid ministryId, Guid loanId, LoanActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(loanId), request, ct));

    [HttpGet("people/{personId:guid}/loan-history")]
    public async Task<ActionResult<Page<MinistryLoanHistoryDto>>> History(Guid parishId, Guid ministryId, Guid personId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(personId), size, cursor, ct));
}
