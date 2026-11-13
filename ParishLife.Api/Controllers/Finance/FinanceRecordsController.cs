// Purpose: exposes the parish-recorded exchange rates, fund budgets, recurring gifts and numbered gift receipts over HTTP.
// Main functions: RecordRate, Rates, CurrentRate, SaveBudget, Budgets, CreateRecurring, UpdateRecurring, RecurringAction, Recurring,
// IssueReceipt, VoidReceipt and Receipts; every rule and permission check lives in the finance services.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Finance;

namespace ParishLife.Api.Controllers.Finance;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/finance")]
public class FinanceRecordsController(ExchangeRateService rates, FundBudgetService budgets, RecurringGiftService recurring, GiftReceiptService receipts) : ControllerBase
{
    [HttpPost("exchange-rates")]
    public async Task<ActionResult<ExchangeRateDto>> RecordRate(Guid parishId, RecordExchangeRateDto request, CancellationToken ct)
        => Ok(await rates.RecordAsync(Guard.Id(parishId), request, ct));

    [HttpGet("exchange-rates")]
    public async Task<ActionResult<IReadOnlyList<ExchangeRateDto>>> Rates(Guid parishId, CancellationToken ct, string? baseCurrency = null, string? quoteCurrency = null)
        => Ok(await rates.ListAsync(Guard.Id(parishId), baseCurrency, quoteCurrency, ct));

    [HttpGet("exchange-rates/current")]
    public async Task<ActionResult<ExchangeRateDto>> CurrentRate(Guid parishId, string baseCurrency, string quoteCurrency, CancellationToken ct, DateOnly? on = null)
        => Ok(await rates.CurrentAsync(Guard.Id(parishId), baseCurrency, quoteCurrency, on, ct));

    [HttpPut("budgets")]
    public async Task<ActionResult<FundBudgetDto>> SaveBudget(Guid parishId, SaveFundBudgetDto request, CancellationToken ct)
        => Ok(await budgets.SaveAsync(Guard.Id(parishId), request, ct));

    [HttpGet("budgets")]
    public async Task<ActionResult<IReadOnlyList<FundBudgetDto>>> Budgets(Guid parishId, CancellationToken ct, int? year = null)
        => Ok(await budgets.ListAsync(Guard.Id(parishId), year, ct));

    [HttpPost("recurring-gifts")]
    public async Task<ActionResult<RecurringGiftDto>> CreateRecurring(Guid parishId, SaveRecurringGiftDto request, CancellationToken ct)
        => Ok(await recurring.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("recurring-gifts/{giftId:guid}")]
    public async Task<ActionResult<RecurringGiftDto>> UpdateRecurring(Guid parishId, Guid giftId, SaveRecurringGiftDto request, CancellationToken ct)
        => Ok(await recurring.SaveAsync(Guard.Id(parishId), Guard.Id(giftId), request, ct));

    [HttpPost("recurring-gifts/{giftId:guid}/actions")]
    public async Task<ActionResult<RecurringGiftDto>> RecurringAction(Guid parishId, Guid giftId, RecurringGiftActionDto request, CancellationToken ct)
        => Ok(await recurring.ActAsync(Guard.Id(parishId), Guard.Id(giftId), request, ct));

    [HttpGet("recurring-gifts")]
    public async Task<ActionResult<IReadOnlyList<RecurringGiftDto>>> Recurring(Guid parishId, CancellationToken ct)
        => Ok(await recurring.ListAsync(Guard.Id(parishId), ct));

    [HttpPost("receipts")]
    public async Task<ActionResult<GiftReceiptDto>> IssueReceipt(Guid parishId, IssueReceiptDto request, CancellationToken ct)
        => Ok(await receipts.IssueAsync(Guard.Id(parishId), request, ct));

    [HttpPost("receipts/{receiptId:guid}/void")]
    public async Task<ActionResult<GiftReceiptDto>> VoidReceipt(Guid parishId, Guid receiptId, VoidReceiptDto request, CancellationToken ct)
        => Ok(await receipts.VoidAsync(Guard.Id(parishId), Guard.Id(receiptId), request, ct));

    [HttpGet("receipts")]
    public async Task<ActionResult<IReadOnlyList<GiftReceiptDto>>> Receipts(Guid parishId, CancellationToken ct)
        => Ok(await receipts.ListAsync(Guard.Id(parishId), ct));
}
