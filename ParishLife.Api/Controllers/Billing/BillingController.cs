// Purpose: HTTP endpoints for billing workflows; delegates work to backend services.
// Main functions: List, Publish, Create, Get, Receive, Coverage.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Billing;

namespace ParishLife.Api.Controllers.Billing;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/billing")]
public sealed class BillingController(BillingService service) : ControllerBase
{
    [HttpPost("invoices")]
    public async Task<IActionResult> Create(Guid parishId, CreateInvoiceDto request, CancellationToken ct) => Ok(InvoiceDto.From(await service.CreateInvoiceAsync(Guard.Id(parishId), request, ct)));
    [HttpGet("invoices/{invoiceId:guid}")]
    public async Task<IActionResult> Get(Guid parishId, Guid invoiceId, CancellationToken ct) => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(invoiceId), ct));
    [HttpPost("invoices/{invoiceId:guid}/cash-receipts")]
    public async Task<IActionResult> Receive(Guid parishId, Guid invoiceId, RecordCashDto request, CancellationToken ct) => Ok(CashReceiptDto.From(await service.RecordCashAsync(Guard.Id(parishId), Guard.Id(invoiceId), request, ct)));
    [HttpGet("coverage")]
    public async Task<IActionResult> Coverage(Guid parishId, CancellationToken ct) => Ok((await service.GetCoverageAsync(Guard.Id(parishId), ct)).Select(CoverageDto.From));
}
