// Purpose: HTTP routes for future-coverage payer transfers (SUB09) and sponsored archdiocese invoices; authorization lives in the services.
// Main functions: ProposeForParish, ProposeForArchdiocese, List, Get, Decide, Cancel, Schedule, CreateSponsoredInvoice, SponsoredInvoice,
// RecordSponsoredCash (platform operator) and InspectSponsoredInvoice (platform operator).

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Billing;

namespace ParishLife.Api.Controllers.Billing;

[Authorize, ApiController, Route("api")]
public sealed class PayerTransfersController(PayerTransferService service, BillingService billing) : ControllerBase
{
    [HttpPost("parishes/{parishId:guid}/payer-transfers/archdioceses/{archdioceseId:guid}")]
    public async Task<ActionResult<PayerTransferDto>> ProposeForParish(Guid parishId, Guid archdioceseId, ProposePayerTransferDto request, CancellationToken ct)
        => Ok(await service.ProposeForParishAsync(Guard.Id(parishId), Guard.Id(archdioceseId), request, ct));

    [HttpPost("archdioceses/{archdioceseId:guid}/payer-transfers/parishes/{parishId:guid}")]
    public async Task<ActionResult<PayerTransferDto>> ProposeForArchdiocese(Guid archdioceseId, Guid parishId, ProposePayerTransferDto request, CancellationToken ct)
        => Ok(await service.ProposeForArchdioceseAsync(Guard.Id(archdioceseId), Guard.Id(parishId), request, ct));

    [HttpGet("parishes/{parishId:guid}/payer-transfers")]
    public async Task<ActionResult<Page<PayerTransferDto>>> List(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.ListAsync(Guard.Id(parishId), size, cursor, ct));

    [HttpGet("parishes/{parishId:guid}/payer-transfers/{transferId:guid}")]
    public async Task<ActionResult<Versioned<PayerTransferDto>>> Get(Guid parishId, Guid transferId, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(transferId), ct));

    [HttpPost("parishes/{parishId:guid}/payer-transfers/{transferId:guid}/decision")]
    public async Task<ActionResult<PayerTransferDto>> Decide(Guid parishId, Guid transferId, DecidePayerTransferDto request, CancellationToken ct)
        => Ok(await service.DecideAsync(Guard.Id(parishId), Guard.Id(transferId), request, ct));

    [HttpPost("parishes/{parishId:guid}/payer-transfers/{transferId:guid}/cancel")]
    public async Task<ActionResult<PayerTransferDto>> Cancel(Guid parishId, Guid transferId, CancelPayerTransferDto request, CancellationToken ct)
        => Ok(await service.CancelAsync(Guard.Id(parishId), Guard.Id(transferId), request, ct));

    [HttpGet("parishes/{parishId:guid}/payer-schedule")]
    public async Task<ActionResult<PayerScheduleDto>> Schedule(Guid parishId, CancellationToken ct)
        => Ok(await service.ScheduleAsync(Guard.Id(parishId), ct));

    [HttpPost("archdioceses/{archdioceseId:guid}/billing/parishes/{parishId:guid}/invoices")]
    public async Task<ActionResult<InvoiceDto>> CreateSponsoredInvoice(Guid archdioceseId, Guid parishId, CreateInvoiceDto request, CancellationToken ct)
        => Ok(await service.CreateSponsoredInvoiceAsync(Guard.Id(archdioceseId), Guard.Id(parishId), request, ct));

    [HttpGet("archdioceses/{archdioceseId:guid}/billing/invoices/{invoiceId:guid}")]
    public async Task<ActionResult<BillingSummaryDto>> SponsoredInvoice(Guid archdioceseId, Guid invoiceId, CancellationToken ct)
        => Ok(await service.GetSponsoredInvoiceAsync(Guard.Id(archdioceseId), Guard.Id(invoiceId), ct));

    [HttpPost("archdioceses/{archdioceseId:guid}/billing/invoices/{invoiceId:guid}/cash-receipts")]
    public async Task<ActionResult<CashReceiptDto>> RecordSponsoredCash(Guid archdioceseId, Guid invoiceId, RecordCashDto request, CancellationToken ct)
        => Ok(CashReceiptDto.From(await billing.RecordCashAsync(Guard.Id(archdioceseId), Guard.Id(invoiceId), request, ct)));

    [HttpGet("administration/archdioceses/{archdioceseId:guid}/invoices/{invoiceId:guid}")]
    public async Task<ActionResult<BillingSummaryDto>> InspectSponsoredInvoice(Guid archdioceseId, Guid invoiceId, CancellationToken ct)
        => Ok(await billing.InspectForOperatorAsync(Guard.Id(archdioceseId), Guard.Id(invoiceId), ct));
}
