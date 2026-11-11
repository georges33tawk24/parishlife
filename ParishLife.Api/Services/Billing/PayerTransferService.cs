// Purpose: transfers who pays for a parish's FUTURE subscription coverage between the parish and a registered archdiocese (SUB09), and lets
// a sponsoring archdiocese invoice exactly the periods it accepted. Both sides approve the exact transfer version in their current capacity:
// the parish's controlling owner (billing.manage, personal capacity, MFA) and the verified archdiocese's registered representative (personal
// capacity, MFA). Acceptance only appends a dated payer period: paid periods, invoices, receipts, data, users, grants and association stay.
// No payment is taken or claimed. One proposal may await a decision at a time; a pending proposal past AcceptBy reads as Expired.
// Main functions: ProposeForParishAsync, ProposeForArchdioceseAsync, GetAsync, ListAsync, ScheduleAsync, DecideAsync, CancelAsync,
// CreateSponsoredInvoiceAsync and GetSponsoredInvoiceAsync; helpers ParishSideAsync, ArchdioceseSideAsync and SideAsync check each party.

using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Interfaces.Repositories.Billing;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Billing;

public class PayerTransferService(IRecordTransactions records, IParishRepository parishes, IParishAccess access, IPlanRepository plans,
    IBillingRepository billing, MfaAccountAccess proof, ICurrentActor actor, TimeProvider clock)
{
    private const string PendingId = "payerTransferPending";
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException Missing() => new("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_transfer_state", message, FailureKind.Conflict);
    private static bool Awaiting(PayerTransfer t) => t.Status is "AwaitingParish" or "AwaitingArchdiocese";

    private void Personal()
    {
        if (actor.ActingAppointmentId is not null)
            throw new DomainException("personal_capacity_required", "Clear the appointment selection for this representative billing action.", FailureKind.Forbidden);
    }

    // Proposed policy (not owner-approved): the parish side of a payer change is its controlling owner holding billing.manage.
    private async Task<Versioned<Parish>> ParishSideAsync(string parishId, CancellationToken ct)
    {
        Personal();
        await proof.RequireMfaAsync(ct);
        var parish = await access.RequireAsync(parishId, Permissions.BillingManage, ct);
        if (parish.Value.OwnerAccountId != actor.AccountId)
            throw new DomainException("owner_authority_required", "Only the parish's controlling owner may approve a payer change.", FailureKind.Forbidden);
        return parish;
    }

    // Proposed policy (not owner-approved): the archdiocese side is its verified registered representative; no bishop/clergy office is implied.
    private async Task<Versioned<Archdiocese>> ArchdioceseSideAsync(string archdioceseId, CancellationToken ct)
    {
        Personal();
        await proof.RequireMfaAsync(ct);
        var org = await parishes.GetArchdioceseAsync(archdioceseId, ct);
        if (org?.Value.Verified != true || org.Value.OwnerAccountId != actor.AccountId)
            throw Missing();
        return org;
    }

    private async Task<string> SideAsync(PayerTransfer t, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is null && (await parishes.GetArchdioceseAsync(t.ArchdioceseId, ct))?.Value.OwnerAccountId == actor.AccountId)
        {
            await ArchdioceseSideAsync(t.ArchdioceseId, ct);
            return "Archdiocese";
        }
        await ParishSideAsync(t.ParishId, ct);
        return "Parish";
    }

    private async Task<Versioned<PayerTransfer>> ReadAsync(string parishId, string id, CancellationToken ct)
        => await records.ReadAsync<PayerTransfer>(Scope(parishId), "payerTransfer:" + id, ct) is { } row && row.Value.ParishId == parishId ? row : throw Missing();

    public async Task<PayerTransferDto> ProposeForParishAsync(string parishId, string archdioceseId, ProposePayerTransferDto request, CancellationToken ct)
    {
        var parish = await ParishSideAsync(parishId, ct);
        if ((await parishes.GetArchdioceseAsync(archdioceseId, ct))?.Value.Verified != true)
            throw Missing();
        return await ProposeAsync(parish, archdioceseId, request, "Parish", ct);
    }

    public async Task<PayerTransferDto> ProposeForArchdioceseAsync(string archdioceseId, string parishId, ProposePayerTransferDto request, CancellationToken ct)
    {
        await ArchdioceseSideAsync(archdioceseId, ct);
        var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
        return await ProposeAsync(parish, archdioceseId, request, "Archdiocese", ct);
    }

    private async Task<PayerTransferDto> ProposeAsync(Versioned<Parish> parish, string archdioceseId, ProposePayerTransferDto request, string side, CancellationToken ct)
    {
        var parishId = parish.Value.Id;
        var op = actor.CreateOperation(request.OperationId, request, clock, "payer-transfer:v1:" + parishId + ":" + archdioceseId + ":" + side);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is { } prior)
            return PayerTransferDto.From((await ReadAsync(parishId, prior.Id, ct)).Value, clock.GetUtcNow());
        if (parish.Value.Status != ParishStatus.Verified)
            throw new DomainException("verification_required", "A verified open parish is required for a payer change.", FailureKind.Conflict);
        var now = clock.GetUtcNow();
        var effective = Guard.Utc(request.EffectiveFrom);
        var acceptBy = Guard.Utc(request.AcceptBy);
        if (acceptBy <= now || effective < acceptBy)
            throw new DomainException("invalid_dates", "The decision deadline must be in the future and no later than the effective date; coverage never moves retroactively.");
        var schedule = (await parishes.GetPayerScheduleAsync(parishId, ct))?.Value;
        if (PayerSchedule.LastChange(schedule) is { } last && effective <= last)
            throw new DomainException("invalid_dates", "The effective date must follow the last scheduled payer change.");
        var (from, to) = request.Direction == "ToArchdiocese" ? (parishId, archdioceseId) : (archdioceseId, parishId);
        if (PayerSchedule.LatestAccount(schedule, parishId) != from)
            throw new DomainException("payer_mismatch", "The current future payer is not this transfer's source.", FailureKind.Conflict);

        var transfer = new PayerTransfer
        {
            Id = op.Id, ParishId = parishId, ArchdioceseId = archdioceseId, Direction = request.Direction, FromAccountId = from, ToAccountId = to,
            EffectiveFrom = effective, AcceptBy = acceptBy, Status = side == "Parish" ? "AwaitingArchdiocese" : "AwaitingParish",
            ProposedSide = side, ProposedBy = actor.AccountId, ProposedAt = op.At, Reason = Guard.Text(request.Reason, "Reason", 1000),
            ParishApprovedBy = side == "Parish" ? actor.AccountId : null, ArchdioceseApprovedBy = side == "Archdiocese" ? actor.AccountId : null
        };
        var changes = new List<RecordChange> { RecordChange.Create("payerTransfer:" + op.Id, "payerTransfer", transfer) };
        var marker = new CommandResult { Id = op.Id, Status = "Pending" };
        var pending = await records.ReadAsync<CommandResult>(Scope(parishId), PendingId, ct);
        if (pending is null)
            changes.Add(RecordChange.Create(PendingId, "payerTransferPending", marker));
        else
        {
            // The single pending marker serializes proposals; a lapsed proposal is closed as Expired in the same transaction.
            var old = await records.ReadAsync<PayerTransfer>(Scope(parishId), "payerTransfer:" + pending.Value.Id, ct);
            if (old is not null && Awaiting(old.Value))
            {
                if (old.Value.AcceptBy > now)
                    throw new DomainException("transfer_pending", "Another payer transfer is awaiting a decision.", FailureKind.Conflict);
                old.Value.Status = "Expired";
                changes.Add(RecordChange.Replace("payerTransfer:" + old.Value.Id, "payerTransfer", old.Value, old.Version));
            }
            changes.Add(RecordChange.Replace(PendingId, "payerTransferPending", marker, pending.Version));
        }
        await records.CommitAsync(Scope(parishId), op, "billing.payer_transfer_propose", op.Id, changes, new CommandResult { Id = op.Id, Status = transfer.Status }, ct);
        return PayerTransferDto.From(transfer, now);
    }

    // Either party reads the transfer: parish billing readers, or the named archdiocese's representative in personal capacity.
    public async Task<Versioned<PayerTransferDto>> GetAsync(string parishId, string id, CancellationToken ct)
    {
        var row = await ReadAsync(parishId, id, ct);
        if (actor.ActingAppointmentId is not null || (await parishes.GetArchdioceseAsync(row.Value.ArchdioceseId, ct))?.Value.OwnerAccountId != actor.AccountId)
            await access.RequireAsync(parishId, Permissions.BillingRead, ct);
        return new Versioned<PayerTransferDto> { Value = PayerTransferDto.From(row.Value, clock.GetUtcNow()), Version = row.Version };
    }

    public async Task<Page<PayerTransferDto>> ListAsync(string parishId, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireAsync(parishId, Permissions.BillingRead, ct);
        var page = await records.PageAsync<PayerTransfer>(Scope(parishId), "payerTransfer", size, cursor, ct);
        var now = clock.GetUtcNow();
        return new Page<PayerTransferDto> { Items = page.Items.Select(r => PayerTransferDto.From(r.Value, now)).OrderByDescending(t => t.ProposedAt).ToArray(), ContinuationToken = page.ContinuationToken };
    }

    public async Task<PayerScheduleDto> ScheduleAsync(string parishId, CancellationToken ct)
    {
        await access.RequireAsync(parishId, Permissions.BillingRead, ct);
        var schedule = (await parishes.GetPayerScheduleAsync(parishId, ct))?.Value;
        return new PayerScheduleDto
        {
            ParishId = parishId, CurrentAccountId = PayerSchedule.AccountFor(schedule, parishId, clock.GetUtcNow(), clock.GetUtcNow()) ?? parishId,
            Periods = (schedule?.Periods ?? []).OrderBy(p => p.EffectiveFrom)
                .Select(p => new PayerPeriodDto { PayerKind = p.PayerKind, BillingAccountId = p.BillingAccountId, EffectiveFrom = p.EffectiveFrom, TransferId = p.TransferId }).ToArray()
        };
    }

    public async Task<PayerTransferDto> DecideAsync(string parishId, string id, DecidePayerTransferDto request, CancellationToken ct)
    {
        var row = await ReadAsync(parishId, id, ct);
        var side = await SideAsync(row.Value, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "payer-transfer-decision:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is not null)
            return PayerTransferDto.From((await ReadAsync(parishId, id, ct)).Value, clock.GetUtcNow());
        if (row.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The transfer changed after it was reviewed; reload it.", FailureKind.Conflict);
        if (request.Accept is null)
            throw new DomainException("invalid_input", "State explicitly whether the transfer is accepted.");
        var t = row.Value;
        if (t.Status != "Awaiting" + side)
            throw State("This transfer is not awaiting your side's decision.");
        if (t.ProposedBy == actor.AccountId)
            throw new DomainException("independent_approval_required", "The proposer cannot also approve for the other side.", FailureKind.Forbidden);
        var now = clock.GetUtcNow();
        if (t.AcceptBy <= now)
            throw new DomainException("transfer_expired", "The decision deadline has passed; propose again.", FailureKind.Conflict);
        var pending = await records.ReadAsync<CommandResult>(Scope(parishId), PendingId, ct);
        if (pending?.Value.Id != t.Id)
            throw State("This transfer is no longer the pending proposal.");
        t.DecidedBy = actor.AccountId;
        t.DecidedAt = now;
        t.DecisionReason = string.IsNullOrWhiteSpace(request.Reason) ? null : Guard.Text(request.Reason, "Reason", 1000);
        var changes = new List<RecordChange>();
        if (request.Accept != true)
            t.Status = "Declined";
        else
        {
            var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
            var org = await parishes.GetArchdioceseAsync(t.ArchdioceseId, ct);
            if (parish.Value.Status != ParishStatus.Verified || org?.Value.Verified != true)
                throw State("Both organizations must be verified and the parish open.");
            // The proposing side's approval only counts while its approver still represents that side (e.g. after ownership recovery it does not).
            if (side == "Archdiocese" ? parish.Value.OwnerAccountId != t.ParishApprovedBy : org.Value.OwnerAccountId != t.ArchdioceseApprovedBy)
                throw new DomainException("approval_stale", "The proposing side's approval no longer comes from its current representative; propose again.", FailureKind.Conflict);
            if (side == "Parish") t.ParishApprovedBy = actor.AccountId;
            else t.ArchdioceseApprovedBy = actor.AccountId;
            var schedule = await parishes.GetPayerScheduleAsync(parishId, ct);
            if (PayerSchedule.LatestAccount(schedule?.Value, parishId) != t.FromAccountId || PayerSchedule.LastChange(schedule?.Value) >= t.EffectiveFrom)
                throw new DomainException("payer_mismatch", "The payer schedule changed since this proposal.", FailureKind.Conflict);
            // Never retroactive and never over already-paid time: paid coverage and money already taken must end by the effective date.
            if ((await parishes.GetCoveragesAsync(parishId, ct)).Any(c => c.EndsAt > t.EffectiveFrom))
                throw new DomainException("paid_coverage_after_effective_date", "Paid coverage runs past the effective date; choose a later date. No credit or refund policy is approved.", FailureKind.Conflict);
            if ((await billing.ListInvoicesAsync(t.FromAccountId, ct)).Any(i => i.ParishId == parishId && i.Paid > 0 && i.EndsAt > t.EffectiveFrom))
                throw new DomainException("paid_invoice_after_effective_date", "Money was already recorded for a period past the effective date; resolve it in billing review first.", FailureKind.Conflict);
            t.Status = "Accepted";
            var period = new PayerPeriod { PayerKind = t.Direction == "ToArchdiocese" ? "Archdiocese" : "Parish", BillingAccountId = t.ToAccountId, EffectiveFrom = t.EffectiveFrom, TransferId = t.Id };
            var next = new PayerSchedule { ParishId = parishId, Periods = [.. schedule?.Value.Periods ?? [], period] };
            // The parish document is the shared revision fence for every coverage writer, including paid activation.
            changes.Add(RecordChange.Replace("parish", "parish", parish.Value, parish.Version));
            changes.Add(schedule is null ? RecordChange.Create("payerSchedule", "payerSchedule", next) : RecordChange.Replace("payerSchedule", "payerSchedule", next, schedule.Version));
        }
        changes.Add(RecordChange.Replace("payerTransfer:" + t.Id, "payerTransfer", t, row.Version));
        changes.Add(RecordChange.Remove(PendingId, pending.Version));
        await records.CommitAsync(Scope(parishId), op, "billing.payer_transfer_" + t.Status.ToLowerInvariant(), t.Id, changes, new CommandResult { Id = t.Id, Status = t.Status }, ct);
        return PayerTransferDto.From(t, now);
    }

    public async Task<PayerTransferDto> CancelAsync(string parishId, string id, CancelPayerTransferDto request, CancellationToken ct)
    {
        var row = await ReadAsync(parishId, id, ct);
        var side = await SideAsync(row.Value, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "payer-transfer-cancel:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parishId), op, ct) is not null)
            return PayerTransferDto.From((await ReadAsync(parishId, id, ct)).Value, clock.GetUtcNow());
        if (row.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The transfer changed after it was reviewed; reload it.", FailureKind.Conflict);
        var t = row.Value;
        if (!Awaiting(t) || t.ProposedSide != side)
            throw State("Only the proposing side can withdraw its own pending transfer; the other side declines it.");
        t.Status = "Cancelled";
        t.DecidedBy = actor.AccountId;
        t.DecidedAt = clock.GetUtcNow();
        t.DecisionReason = Guard.Text(request.Reason, "Reason", 1000);
        var changes = new List<RecordChange> { RecordChange.Replace("payerTransfer:" + t.Id, "payerTransfer", t, row.Version) };
        if (await records.ReadAsync<CommandResult>(Scope(parishId), PendingId, ct) is { } pending && pending.Value.Id == t.Id)
            changes.Add(RecordChange.Remove(PendingId, pending.Version));
        await records.CommitAsync(Scope(parishId), op, "billing.payer_transfer_cancelled", t.Id, changes, new CommandResult { Id = t.Id, Status = t.Status }, ct);
        return PayerTransferDto.From(t, clock.GetUtcNow());
    }

    // A sponsoring archdiocese issues an invoice only for a whole period that its accepted transfer makes it pay; the operator records cash.
    public async Task<InvoiceDto> CreateSponsoredInvoiceAsync(string archdioceseId, string parishId, CreateInvoiceDto request, CancellationToken ct)
    {
        await ArchdioceseSideAsync(archdioceseId, ct);
        var parish = await parishes.GetAsync(parishId, ct) ?? throw Missing();
        var schedule = (await parishes.GetPayerScheduleAsync(parishId, ct))?.Value;
        if (schedule?.Periods.Any(p => p.BillingAccountId == archdioceseId) != true)
            throw Missing();
        if (parish.Value.Status != ParishStatus.Verified)
            throw new DomainException("verification_required", "A verified open parish is required.", FailureKind.Conflict);
        var plan = await plans.GetAsync(Guard.Id(request.PlanId), ct) ?? throw new DomainException("plan_not_found", "The selected plan does not exist.", FailureKind.NotFound);
        var start = Guard.Utc(request.StartsAt);
        if (start > DateTimeOffset.MaxValue.AddMonths(-plan.TermMonths))
            throw new DomainException("invalid_period", "The subscription period exceeds the supported date range.");
        var end = start.AddMonths(plan.TermMonths);
        if (PayerSchedule.AccountFor(schedule, parishId, start, end) != archdioceseId)
            throw new DomainException("payer_not_archdiocese", "The accepted payer schedule does not make this archdiocese pay for the whole period.", FailureKind.Conflict);
        var op = actor.CreateOperation(request.OperationId, request, clock, "sponsored-invoice:" + parishId);
        var invoice = new Invoice
        {
            Id = op.Id, ParishId = parishId, BillingAccountId = archdioceseId, PlanId = plan.Id, PlanName = plan.Name, Modules = [.. plan.Modules],
            Total = plan.Price, StartsAt = start, EndsAt = end, Paid = 0, CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        return InvoiceDto.From(await billing.CreateInvoiceAsync(invoice, op, ct));
    }

    public async Task<BillingSummaryDto> GetSponsoredInvoiceAsync(string archdioceseId, string invoiceId, CancellationToken ct)
    {
        await ArchdioceseSideAsync(archdioceseId, ct);
        return await BillingService.Summary(billing, archdioceseId, invoiceId, ct);
    }
}
