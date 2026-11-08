// Purpose: Coordinates plan/invoice/receipt operations and durable subscription coverage with current access
// checks.
// Main functions: ListPlansAsync, PublishPlanAsync, CreateInvoiceAsync, GetAsync, InspectForOperatorAsync,
// ReadFinancialSummary, RecordCashAsync, GetCoverageAsync, ProcessAsync.

using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Interfaces.Repositories.Billing;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Billing;

public sealed class BillingService(IPlanRepository plans, IBillingRepository billing, IParishRepository parishes, IParishAccess access, ICurrentActor actor, IPlatformAccess platform, TimeProvider clock)
{
    public Task<IReadOnlyList<PlanDefinition>> ListPlansAsync(CancellationToken ct) => plans.ListAsync(ct);
    public async Task<PlanDefinition> PublishPlanAsync(PublishPlanDto request, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        var op = actor.CreateOperation(request.OperationId, request, clock);
        var plan = new PlanDefinition
        {
            Id = op.Id,
            Name = Guard.Text(request.Name, "Plan name"),
            Price = Money.Create(request.Amount, request.Currency, request.MinorUnits),
            TermMonths = request.TermMonths,
            Modules = request.Modules ?? [],
            PublishedAt = op.At
        };
        plan.Validate();
        return await plans.PublishAsync(plan, op, ct);
    }

    public async Task<Invoice> CreateInvoiceAsync(string parishId, CreateInvoiceDto request, CancellationToken ct)
    {
        var parish = await access.RequireAsync(parishId, Permissions.BillingManage, ct);
        if (parish.Value.Status != ParishStatus.Verified)
            throw new DomainException("verification_required", "Parish representative verification is required before purchase.", FailureKind.Conflict);
        var plan = await plans.GetAsync(Guard.Id(request.PlanId), ct) ?? throw new DomainException("plan_not_found", "The selected plan does not exist.", FailureKind.NotFound);
        var start = Guard.Utc(request.StartsAt);
        if (start > DateTimeOffset.MaxValue.AddMonths(-plan.TermMonths))
            throw new DomainException("invalid_period", "The subscription period exceeds the supported date range.");
        // Each published plan is immutable. Invoices retain its exact commercial snapshot.
        var op = actor.CreateOperation(request.OperationId, request, clock);
        var invoice = new Invoice
        {
            Id = op.Id,
            ParishId = parishId,
            BillingAccountId = parishId,
            PlanId = plan.Id,
            PlanName = plan.Name,
            Modules = [.. plan.Modules],
            Total = plan.Price,
            StartsAt = start,
            EndsAt = start.AddMonths(plan.TermMonths),
            Paid = 0,
            CreatedBy = actor.AccountId,
            CreatedAt = op.At
        };
        return await billing.CreateInvoiceAsync(invoice, op, ct);
    }

    public async Task<BillingSummaryDto> GetAsync(string parishId, string invoiceId, CancellationToken ct)
    {
        await access.RequireAsync(parishId, Permissions.BillingRead, ct);
        return await ReadFinancialSummary(parishId, invoiceId, ct);
    }

    public async Task<BillingSummaryDto> InspectForOperatorAsync(string parishId, string invoiceId, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        return await ReadFinancialSummary(parishId, invoiceId, ct);
    }

    private async Task<BillingSummaryDto> ReadFinancialSummary(string parishId, string invoiceId, CancellationToken ct)
    {
        var invoice = await billing.GetInvoiceAsync(parishId, invoiceId, ct) ?? throw new DomainException("invoice_not_found", "The invoice does not exist.", FailureKind.NotFound);
        return new BillingSummaryDto
        {
            Invoice = new Versioned<InvoiceDto> { Value = InvoiceDto.From(invoice.Value), Version = invoice.Version },
            Receipts = (await billing.GetReceiptsAsync(parishId, invoiceId, ct)).Select(CashReceiptDto.From).ToArray(),
            ActivationStatus = await billing.GetActivationStatusAsync(parishId, invoiceId, ct)
        };
    }

    public async Task<CashReceipt> RecordCashAsync(string parishId, string invoiceId, RecordCashDto request, CancellationToken ct)
    {
        // Paying customers cannot self-confirm that ParishLife received money.
        await platform.RequireOperatorAsync(ct);
        var invoice = await billing.GetInvoiceAsync(parishId, invoiceId, ct) ?? throw new DomainException("invoice_not_found", "The invoice does not exist.", FailureKind.NotFound);
        Guard.Utc(request.ReceivedAt);
        if (request.ReceivedAt > clock.GetUtcNow())
            throw new DomainException("future_receipt", "Cash receipt time cannot be in the future.");
        var op = actor.CreateOperation(request.OperationId, request, clock, "cash:" + invoiceId);
        var receipt = new CashReceipt
        {
            Id = op.Id,
            InvoiceId = invoiceId,
            ParishId = parishId,
            Received = Money.Create(request.Amount, request.Currency, invoice.Value.Total.MinorUnits),
            ReceivedAt = request.ReceivedAt,
            PayerName = Guard.Text(request.PayerName, "Payer"),
            CollectedBy = Guard.Text(request.CollectedBy, "Collector"),
            ReceiptReference = Guard.Text(request.ReceiptReference, "Receipt reference"),
            RecordedBy = actor.AccountId,
            RecordedAt = op.At
        };
        return await billing.ReceiveCashAsync(parishId, invoiceId, Versions.Require(request.Version), receipt, op, ct);
    }

    public async Task<IReadOnlyList<Coverage>> GetCoverageAsync(string parishId, CancellationToken ct)
    {
        await access.RequireAsync(parishId, Permissions.BillingRead, ct);
        return await parishes.GetCoveragesAsync(parishId, ct);
    }
}

// Background entry point has no HTTP identity and receives only validated durable work.
public sealed class CoverageActivationProcessor(IBillingRepository billing, IParishRepository parishes, TimeProvider clock)
{
    public async Task<int> ProcessAsync(string workerId, CancellationToken ct)
    {
        var completed = 0;
        foreach (var candidate in await billing.FindDueActivationsAsync(clock.GetUtcNow(), ct))
        {
            var leased = await billing.TryLeaseAsync(candidate, workerId, clock.GetUtcNow(), ct);
            if (leased is null)
                continue;
            var item = leased.Value;
            try
            {
                var invoice = await billing.GetInvoiceAsync(item.Coverage.BillingAccountId, item.Coverage.InvoiceId, ct);
                if (invoice?.Value.Status != "Paid" || invoice.Value.ParishId != item.Coverage.ParishId || invoice.Value.StartsAt != item.Coverage.StartsAt || invoice.Value.EndsAt != item.Coverage.EndsAt || invoice.Value.PlanId != item.Coverage.PlanId || !invoice.Value.Modules.SequenceEqual(item.Coverage.Modules))
                    throw new DomainException("activation_evidence_invalid", "Activation does not match a fully paid invoice.", FailureKind.Conflict);
                var operation = Operation.Create(Guid.Parse(item.Id), "system:billing-activation", new { Action = "activate_paid_coverage", item.RecordedBy, item.Coverage }, clock);
                await parishes.ActivateCoverageAsync(item.Coverage, operation, ct);
                await billing.CompleteActivationAsync(leased, "Completed", null, ct);
                completed++;
            }
            catch (DomainException ex) when (ex.Code == "write_conflict")
            {
                // An unrelated parish revision can race activation. Retry the same
                // durable operation after lease expiry; this is not a billing refusal.
            }
            catch (DomainException ex) when (ex.Kind is FailureKind.Conflict or FailureKind.Validation)
            {
                await billing.CompleteActivationAsync(leased, "NeedsReview", ex.Code, ct);
            }
            // Unknown/transient outcomes retain their lease and retry after expiry.
            // Never turn an uncertain activation into a false success or release data.
        }

        return completed;
    }
}
