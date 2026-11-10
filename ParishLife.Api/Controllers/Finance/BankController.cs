// Purpose: exposes bank statement import, line matching and month reconciliation over HTTP.
// Main functions: Import, Lines, Act, Reconcile, Reopen and Reconciliations delegate rules to BankReconciliationService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Finance;

namespace ParishLife.Api.Controllers.Finance;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/finance/bank")]
public class BankController(BankReconciliationService service) : ControllerBase
{
    [HttpPost("imports")]
    public async Task<ActionResult<BankImportResultDto>> Import(Guid parishId, ImportBankLinesDto request, CancellationToken ct)
        => Ok(await service.ImportAsync(Guard.Id(parishId), request, ct));

    [HttpGet("lines")]
    public async Task<ActionResult<IReadOnlyList<BankLineDto>>> Lines(Guid parishId, CancellationToken ct, string? account = null, string? status = null)
        => Ok(await service.LinesAsync(Guard.Id(parishId), account, status, ct));

    [HttpPost("lines/{lineId}/actions")]
    public async Task<ActionResult<BankLineDto>> Act(Guid parishId, string lineId, BankLineActionDto request, CancellationToken ct)
        => Ok(await service.ActAsync(Guard.Id(parishId), Guard.Text(lineId, "Line", 64), request, ct));

    [HttpPost("reconciliations")]
    public async Task<ActionResult<BankReconciliationDto>> Reconcile(Guid parishId, ReconcileBankDto request, CancellationToken ct)
        => Ok(await service.ReconcileAsync(Guard.Id(parishId), request, ct));

    [HttpPost("reconciliations/reopen")]
    public async Task<ActionResult<BankReconciliationDto>> Reopen(Guid parishId, ReconcileBankDto request, CancellationToken ct)
        => Ok(await service.ReopenAsync(Guard.Id(parishId), request, ct));

    [HttpGet("reconciliations")]
    public async Task<ActionResult<IReadOnlyList<BankReconciliationDto>>> Reconciliations(Guid parishId, CancellationToken ct)
        => Ok(await service.ReconciliationsAsync(Guard.Id(parishId), ct));
}
