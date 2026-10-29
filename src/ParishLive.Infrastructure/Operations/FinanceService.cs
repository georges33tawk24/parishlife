using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed record MoneyCommand(Guid ParishId, MovementKind Kind, decimal Amount, string Currency, string Account,
    string? DestinationAccount, string Fund, string SourceReference, Guid OperationId, Guid? ReversesId = null);
public sealed record FinanceSummary(IReadOnlyDictionary<string, long> Balances, IReadOnlyDictionary<string, long> Receipts,
    IReadOnlyDictionary<string, long> Expenses, DateTimeOffset AsOfUtc);

public sealed class FinanceService(AppDbContext db, ITenantContext tenant, OperationalAccess access, OperationRunner operations)
{
    public static long MinorUnits(decimal amount, string currency)
    {
        var factor = currency switch { "USD" => 100m, "LBP" => 1m, _ => throw new DomainException("Error.Currency") };
        if (amount <= 0 || amount > long.MaxValue / factor || amount * factor != decimal.Truncate(amount * factor))
            throw new DomainException("Error.Money");
        return checked((long)(amount * factor));
    }

    private async Task ReadyAsync(Guid parishId)
    {
        if (!await db.ParishPolicies.AnyAsync(p => p.ParishId == parishId && p.FinancePolicyApproved))
            throw new DomainException("Error.FinancePolicy");
    }

    public async Task<OperationResult> SubmitAsync(MoneyCommand input)
    {
        var assignment = await access.RequireAsync(input.ParishId, SystemRole.Treasurer, SystemRole.Secretary);
        if (assignment.Role == SystemRole.Secretary && (input.Account != "OfficeCash" ||
            input.Kind is not (MovementKind.Expense or MovementKind.Opening))) throw new ForbiddenException("Error.Unavailable");
        await ReadyAsync(input.ParishId);
        var units = MinorUnits(input.Amount, input.Currency);
        if (input.Kind is not (MovementKind.Expense or MovementKind.Transfer or MovementKind.Opening or MovementKind.Refund)) throw new DomainException("Error.State");
        Validate(input);
        return await operations.RunAsync(input.ParishId, input.OperationId, "Finance.Submit", input, async () =>
        {
            var request = new FinancialRequest { OrgId = tenant.OrgId, ParishId = input.ParishId,
                Kind = input.Kind, Units = units, Currency = input.Currency, Account = input.Account,
                DestinationAccount = input.DestinationAccount, Fund = input.Fund, SourceReference = input.SourceReference,
                SubmittedByUserId = access.UserId, ReversesId = input.ReversesId };
            db.FinancialRequests.Add(request); await db.SaveChangesAsync(); return new(request.Id, request.Revision);
        });
    }

    public async Task<OperationResult> ApproveAsync(Guid id, long revision, Guid operationId)
    {
        var request = await db.FinancialRequests.SingleOrDefaultAsync(r => r.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.FinanceAsync(request.ParishId, true);
        return await operations.RunAsync(request.ParishId, operationId, "Finance.Approve", new { id, revision }, async () =>
        {
            OperationRunner.Expect(request, revision);
            if (request.SubmittedByUserId == access.UserId) throw new DomainException("Error.IndependentReviewer");
            if (request.Status != "Submitted") throw new DomainException("Error.State");
            request.ApprovedByUserId = access.UserId; request.Status = "Approved";
            await db.SaveChangesAsync(); return new(request.Id, request.Revision);
        });
    }

    public async Task<OperationResult> PayAsync(Guid id, long revision, string actualEvidence, DateTimeOffset actualAt, Guid operationId)
    {
        var request = await db.FinancialRequests.SingleOrDefaultAsync(r => r.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.RequireAsync(request.ParishId, SystemRole.Treasurer, SystemRole.Secretary);
        await ReadyAsync(request.ParishId);
        if (actualAt > DateTimeOffset.UtcNow) throw new DomainException("Error.Invalid");
        return await operations.RunAsync(request.ParishId, operationId, "Finance.Pay", new { id, revision, actualEvidence, actualAt }, async () =>
        {
            OperationRunner.Expect(request, revision);
            if (request.Status != "Approved" || request.ApprovedByUserId is null || request.ApprovedByUserId == request.SubmittedByUserId)
                throw new DomainException("Error.IndependentReviewer");
            Guard.Required(actualEvidence, "Actual payment evidence", 500);
            var assignment = await access.RequireAsync(request.ParishId, SystemRole.Treasurer, SystemRole.Secretary);
            if (assignment.Role == SystemRole.Secretary && (request.Account != "OfficeCash" ||
                request.Kind is not (MovementKind.Expense or MovementKind.Opening))) throw new ForbiddenException("Error.Unavailable");
            if (request.Kind == MovementKind.Opening && await db.LedgerMovements.AnyAsync(m => m.ParishId == request.ParishId &&
                m.Currency == request.Currency && m.Account == request.Account && m.Kind == MovementKind.Opening))
                throw new DomainException("Error.OpeningExists");
            if (request.Kind == MovementKind.Refund)
            {
                var original = await db.LedgerMovements.SingleOrDefaultAsync(m => m.Id == request.ReversesId && m.Kind == MovementKind.Receipt);
                if (original is null || original.Currency != request.Currency) throw new DomainException("Error.Money");
                var refunded = await db.LedgerMovements.Where(m => m.ReversesId == original.Id && m.Kind == MovementKind.Refund).SumAsync(m => m.Units);
                if (request.Units > original.Units - refunded) throw new DomainException("Error.Money");
            }
            if (request.Kind == MovementKind.Reversal) throw new DomainException("Error.ReversalReview");
            var movement = new LedgerMovement { OrgId = request.OrgId, ParishId = request.ParishId, Kind = request.Kind,
                Currency = request.Currency, Units = request.Units, Account = request.Account,
                DestinationAccount = request.DestinationAccount, Fund = request.Fund, SourceReference = request.SourceReference,
                ActorUserId = access.UserId, ApprovedByUserId = request.ApprovedByUserId, ReversesId = request.ReversesId, ActualAtUtc = actualAt };
            db.LedgerMovements.Add(movement); request.MovementId = movement.Id; request.Status = "Paid";
            Journal(request.ParishId, request.Id, "PaymentRecorded", actualEvidence);
            await db.SaveChangesAsync(); return new(movement.Id, 1);
        });
    }

    public async Task<OperationResult> ReceiveAsync(MoneyCommand input, string method, DateTimeOffset receivedAt,
        IReadOnlyDictionary<string, decimal> allocations)
    {
        await access.FinanceAsync(input.ParishId, true); await ReadyAsync(input.ParishId);
        if (input.Kind != MovementKind.Receipt || method is not ("Cash" or "VerifiedBank" or "VerifiedOMT") || receivedAt > DateTimeOffset.UtcNow)
            throw new DomainException("Error.ActualReceipt");
        Validate(input);
        var units = MinorUnits(input.Amount, input.Currency);
        var allocated = allocations.ToDictionary(a => Guard.Required(a.Key, "Purpose", 200), a => MinorUnits(a.Value, input.Currency));
        var remaining = units;
        foreach (var allocation in allocated.Values)
        { if (allocation > remaining) throw new DomainException("Error.Allocations"); remaining -= allocation; }
        return await operations.RunAsync(input.ParishId, input.OperationId, "Finance.Receipt", new { input, method, receivedAt, allocations }, async () =>
        {
            var movement = new LedgerMovement { OrgId = tenant.OrgId, ParishId = input.ParishId, Kind = MovementKind.Receipt,
                Units = units, Currency = input.Currency, Account = input.Account, Fund = input.Fund,
                SourceReference = input.SourceReference, ActorUserId = access.UserId, ActualAtUtc = receivedAt };
            db.LedgerMovements.Add(movement);
            foreach (var allocation in allocated)
                db.MovementAllocations.Add(new MovementAllocation { OrgId = tenant.OrgId, ParishId = input.ParishId,
                    MovementId = movement.Id, PurposeReference = allocation.Key, Fund = input.Fund, Units = allocation.Value });
            await db.SaveChangesAsync(); return new(movement.Id, 1);
        });
    }

    public async Task<FinanceSummary> SummaryAsync(Guid parishId, bool officeOnly = false)
    {
        if (officeOnly) await access.RequireAsync(parishId, SystemRole.Priest, SystemRole.Secretary, SystemRole.Treasurer);
        else await access.FinanceAsync(parishId);
        var rows = await db.LedgerMovements.AsNoTracking().Where(m => m.ParishId == parishId).ToListAsync();
        var balances = new Dictionary<string, long>(); var receipts = new Dictionary<string, long>(); var expenses = new Dictionary<string, long>();
        void Add(Dictionary<string, long> values, string key, long units) => values[key] = checked(values.GetValueOrDefault(key) + units);
        foreach (var row in rows)
        {
            var incoming = row.Kind is MovementKind.Opening or MovementKind.Receipt;
            if (!officeOnly || row.Account == "OfficeCash") Add(balances, row.Account + "/" + row.Currency, incoming ? row.Units : -row.Units);
            if (row.Kind == MovementKind.Transfer && (!officeOnly || row.DestinationAccount == "OfficeCash"))
                Add(balances, row.DestinationAccount + "/" + row.Currency, row.Units);
            if (officeOnly && row.Account != "OfficeCash") continue;
            if (row.Kind == MovementKind.Receipt) Add(receipts, row.Currency, row.Units);
            if (row.Kind == MovementKind.Refund) Add(receipts, row.Currency, -row.Units);
            if (row.Kind == MovementKind.Expense) Add(expenses, row.Currency, row.Units);
        }
        return new(balances, receipts, expenses, DateTimeOffset.UtcNow);
    }

    public async Task<OperationResult> OpenCountAsync(Guid parishId, string source, Guid operationId, DateTimeOffset collectedAtUtc)
    {
        await access.FinanceAsync(parishId, true); await ReadyAsync(parishId);
        if (collectedAtUtc > DateTimeOffset.UtcNow) throw new DomainException("Error.ActualReceipt");
        return await operations.RunAsync(parishId, operationId, "Giving.Open", new { parishId, source, collectedAtUtc }, async () =>
        {
            var batch = new GivingBatch { OrgId = tenant.OrgId, ParishId = parishId, OpenedByUserId = access.UserId,
                SourceReference = Guard.Required(source, "Collection source", 200), CollectedAtUtc = collectedAtUtc };
            db.GivingBatches.Add(batch); await db.SaveChangesAsync(); return new(batch.Id, batch.Revision);
        });
    }

    public async Task<OperationResult> AddCountLineAsync(Guid id, long revision, decimal amount, string currency, string fund, Guid operationId)
    {
        var batch = await db.GivingBatches.SingleOrDefaultAsync(b => b.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.FinanceAsync(batch.ParishId, true);
        var units = MinorUnits(amount, currency);
        return await operations.RunAsync(batch.ParishId, operationId, "Giving.Line", new { id, revision, amount, currency, fund }, async () =>
        {
            OperationRunner.Expect(batch, revision);
            if (batch.Status == "Closed") throw new DomainException("Error.Immutable");
            db.GivingLines.Add(new GivingLine { OrgId = batch.OrgId, ParishId = batch.ParishId, BatchId = id,
                Units = units, Currency = currency, Fund = Guard.Required(fund, "Fund", 200) });
            batch.VerifiedByUserId = null; batch.VerifiedRevision = null; batch.Status = "Open";
            batch.UpdatedAtUtc = DateTimeOffset.UtcNow;
            Journal(batch.ParishId, batch.Id, "CountLineAdded", currency + " " + amount.ToString(CultureInfo.InvariantCulture));
            await db.SaveChangesAsync(); return new(batch.Id, batch.Revision);
        });
    }

    public async Task<OperationResult> VerifyCountAsync(Guid id, long revision, IReadOnlyDictionary<string, long> actualTotals, Guid operationId)
    {
        if (actualTotals.Any(t => t.Key is not ("USD" or "LBP") || t.Value < 0)) throw new DomainException("Error.Money");
        var batch = await db.GivingBatches.SingleOrDefaultAsync(b => b.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.FinanceAsync(batch.ParishId, true);
        return await operations.RunAsync(batch.ParishId, operationId, "Giving.Verify", new { id, revision, actualTotals }, async () =>
        {
            OperationRunner.Expect(batch, revision);
            if (batch.Status == "Closed") throw new DomainException("Error.Immutable");
            if (batch.OpenedByUserId == access.UserId) throw new DomainException("Error.IndependentReviewer");
            var lines = await db.GivingLines.Where(l => l.BatchId == id).ToListAsync();
            var totals = lines.GroupBy(l => l.Currency).ToDictionary(g => g.Key, g => g.Sum(l => l.Units));
            var agrees = totals.Count > 0 && totals.Count == actualTotals.Count && totals.All(t => actualTotals.TryGetValue(t.Key, out var value) && t.Value == value);
            batch.ObservationJson = JsonSerializer.Serialize(actualTotals);
            batch.Status = agrees ? "Verified" : "Variance";
            batch.VerifiedByUserId = agrees ? access.UserId : null;
            batch.VerifiedRevision = agrees ? revision + 1 : null;
            Journal(batch.ParishId, batch.Id, batch.Status, batch.ObservationJson);
            await db.SaveChangesAsync(); return new(batch.Id, batch.Revision);
        });
    }

    public async Task<OperationResult> CloseCountAsync(Guid id, long revision, Guid operationId)
    {
        var batch = await db.GivingBatches.SingleOrDefaultAsync(b => b.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.FinanceAsync(batch.ParishId, true);
        return await operations.RunAsync(batch.ParishId, operationId, "Giving.Close", new { id, revision }, async () =>
        {
            OperationRunner.Expect(batch, revision);
            if (batch.Status != "Verified" || batch.VerifiedRevision != revision || batch.VerifiedByUserId is null ||
                batch.VerifiedByUserId == batch.OpenedByUserId) throw new DomainException("Error.IndependentReviewer");
            if (batch.CollectedAtUtc is null) throw new DomainException("Error.ActualReceipt");
            var lines = await db.GivingLines.Where(l => l.BatchId == id).ToListAsync();
            foreach (var line in lines)
            {
                var movement = new LedgerMovement { OrgId = batch.OrgId, ParishId = batch.ParishId, Kind = MovementKind.Receipt,
                    Currency = line.Currency, Units = line.Units, Account = "ParishCash", Fund = line.Fund,
                    SourceReference = "COUNT/" + line.Id, ActorUserId = access.UserId, ApprovedByUserId = batch.VerifiedByUserId,
                    ActualAtUtc = batch.CollectedAtUtc.Value };
                db.LedgerMovements.Add(movement); line.MovementId = movement.Id;
            }
            batch.Status = "Closed";
            Journal(batch.ParishId, batch.Id, "Closed", batch.SourceReference);
            await db.SaveChangesAsync(); return new(batch.Id, batch.Revision);
        });
    }

    private static void Validate(MoneyCommand input)
    {
        Guard.Required(input.Account, "Account", 100); Guard.Required(input.Fund, "Fund", 200);
        Guard.Required(input.SourceReference, "Actual source reference", 200);
        if (input.Kind == MovementKind.Transfer && (string.IsNullOrWhiteSpace(input.DestinationAccount) || input.Account == input.DestinationAccount))
            throw new DomainException("Error.Money");
    }

    private void Journal(Guid parish, Guid id, string action, string note) => db.CaseHistories.Add(new CaseHistory
    { OrgId = tenant.OrgId, ParishId = parish, CaseId = id, Action = "Finance." + action, ActorUserId = access.UserId, InternalNote = note });
}
