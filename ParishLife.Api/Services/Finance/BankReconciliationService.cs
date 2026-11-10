// Purpose: imports bank statement lines (validated whole-file, duplicate-safe), matches each line through explicit allocations to posted gifts,
// paid expenses, fees or explained other items whose total equals the line exactly, keeps unexplained differences outstanding with a reason,
// and lets an independent reviewer close (lock) or reopen one account's month.
// Main functions: ImportAsync, LinesAsync, ActAsync, ReconcileAsync, ReopenAsync and ReconciliationsAsync.

using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Services.Finance;

public class BankReconciliationService(IRecordTransactions records, GivingService giving, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    private static string Period(DateOnly date) => date.ToString("yyyy-MM", CultureInfo.InvariantCulture);
    private static string ReconciliationKey(string account, string period) => "bankReconciliation:" + account + ":" + period;

    private static string Account(string value)
        => Guard.Text(value, "Bank account", 100) is var account && !account.Contains(':') ? account : throw new DomainException("invalid_input", "Bank account names cannot contain ':'.");

    public async Task<BankImportResultDto> ImportAsync(string parish, ImportBankLinesDto request, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var account = Account(request.BankAccount);
        var lines = request.Csv.Replace("\r\n", "\n").Split('\n').Where(l => l.Length > 0).ToList();
        if (lines.Count < 2 || !PeopleImportService.Split(lines[0]).SequenceEqual(["Date", "Reference", "Amount", "Currency"]))
            throw new DomainException("invalid_input", "Use the header Date,Reference,Amount,Currency.");
        if (lines.Count > 2001)
            throw new DomainException("invalid_input", "Import up to 2000 lines at a time.");
        var batch = Guard.Id(request.OperationId);
        var parsed = new List<BankLine>();
        var problems = new List<string>();
        // The whole file is checked first; nothing is written if any line is wrong.
        for (var i = 1; i < lines.Count; i++)
        {
            var cells = PeopleImportService.Split(lines[i]);
            if (cells.Length != 4 || !DateOnly.TryParseExact(cells[0].Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
                || !decimal.TryParse(cells[2].Trim(), NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var amount)
                || amount == 0 || decimal.Round(amount, 2) != amount || cells[3].Trim() is not { Length: 3 } currency || currency.Any(c => c is < 'A' or > 'Z')
                || cells[1].Trim() is not { Length: > 0 and <= 200 } reference)
            {
                problems.Add("Line " + (i + 1) + " needs an ISO date, a reference, a non-zero signed amount with up to two decimals and a currency code.");
                continue;
            }
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(account + "|" + cells[0].Trim() + "|" + reference + "|" + amount.ToString(CultureInfo.InvariantCulture) + "|" + currency)))[..32];
            parsed.Add(new BankLine
            {
                Id = hash.ToLowerInvariant(), ParishId = parish, BankAccount = account, BatchId = batch, PostedOn = date, Reference = reference, Amount = amount,
                Currency = currency, Original = lines[i]
            });
        }
        if (problems.Count > 0)
            throw new DomainException("invalid_input", string.Join(" ", problems.Take(20)));
        // A line already imported (same account, date, reference, amount and currency) is reported, not posted twice; repeats inside one file count once.
        var fresh = new List<BankLine>();
        var duplicates = 0;
        foreach (var line in parsed.DistinctBy(l => l.Id))
            if (await records.ReadAsync<BankLine>(Scope(parish), "bankLine:" + line.Id, ct) is null) fresh.Add(line);
            else duplicates++;
        duplicates += parsed.Count - parsed.DistinctBy(l => l.Id).Count();
        foreach (var chunk in fresh.Chunk(90))
        {
            var root = await giving.AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
            var op = Operation.Create(Guid.NewGuid(), actor.AccountId, new { batch, first = chunk[0].Id }, clock, "bank-import:v1:" + parish, actor.ActingAppointmentId);
            await records.CommitAsync(Scope(parish), op, "bank.import", batch, [Fence(root), .. chunk.Select(l => RecordChange.Create("bankLine:" + l.Id, "bankLine", l))],
                new CommandResult { Id = batch, Status = chunk.Length.ToString(CultureInfo.InvariantCulture) }, ct);
        }
        return new BankImportResultDto { BatchId = batch, Imported = fresh.Count, Duplicates = duplicates };
    }

    public async Task<IReadOnlyList<BankLineDto>> LinesAsync(string parish, string? account, string? status, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var conditions = status is null ? [] : new[] { new RecordCondition { Path = "status", Comparison = "eq", Value = status } };
        return (await records.CollectAsync<BankLine>(Scope(parish), "bankLine", ct, 20000, conditions))
            .Where(r => account is null || r.Value.BankAccount == account).OrderBy(r => r.Value.PostedOn).ThenBy(r => r.Value.Reference, StringComparer.Ordinal)
            .Select(Project).ToArray();
    }

    public async Task<BankLineDto> ActAsync(string parish, string id, BankLineActionDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, request.Action == "unmatch" ? Permissions.FinanceApprove : Permissions.FinancePost, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "bank-line:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)));
        var item = (await ReadAsync(parish, id, ct)).Value;
        if ((await records.ReadAsync<BankReconciliation>(Scope(parish), ReconciliationKey(item.BankAccount, Period(item.PostedOn)), ct))?.Value.Status == "Closed")
            throw GivingService.State("This month is reconciled; reopen it with a reason before changing its lines.");
        var changes = new List<RecordChange> { Fence(root) };
        switch (request.Action)
        {
            case "match" when item.Status is "Unmatched" or "Outstanding":
                item.Allocations = await AllocationsAsync(parish, item, request.Allocations ?? [], changes, ct);
                item.Status = "Matched";
                item.OutstandingReason = null;
                item.MatchedBy = actor.AccountId;
                item.MatchedAt = op.At;
                break;
            case "outstanding" when item.Status == "Unmatched":
                item.Status = "Outstanding";
                item.OutstandingReason = Guard.Text(request.Reason, "Reason and owner", 1000);
                break;
            case "unmatch" when item.Status is "Matched" or "Outstanding":
                Guard.Text(request.Reason, "Reason", 1000);
                item.Status = "Unmatched";
                item.Allocations = [];
                item.OutstandingReason = null;
                item.MatchedBy = null;
                item.MatchedAt = null;
                break;
            default:
                throw GivingService.State("That action is not available for a " + item.Status + " line.");
        }
        changes.Add(RecordChange.Replace("bankLine:" + id, "bankLine", item, Versions.Require(request.Version)));
        await records.CommitAsync(Scope(parish), op, "bank." + request.Action, id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(await ReadAsync(parish, id, ct));
    }

    // An independent reviewer (who matched none of the month's lines) closes it once every line is matched or explained as outstanding.
    public async Task<BankReconciliationDto> ReconcileAsync(string parish, ReconcileBankDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var account = Account(request.BankAccount);
        var op = actor.CreateOperation(request.OperationId, request, clock, "bank-reconcile:v1:" + account + ":" + request.Period);
        var key = ReconciliationKey(account, request.Period);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await records.ReadAsync<BankReconciliation>(Scope(parish), key, ct))!.Value);
        var lines = (await records.CollectAsync<BankLine>(Scope(parish), "bankLine", ct, 20000)).Select(r => r.Value)
            .Where(l => l.BankAccount == account && Period(l.PostedOn) == request.Period).ToList();
        if (lines.Count == 0)
            throw GivingService.State("No statement lines were imported for this account and month.");
        if (lines.Any(l => l.Status == "Unmatched"))
            throw GivingService.State("Match every line or record it as outstanding with a reason before closing the month.");
        if (lines.Any(l => l.MatchedBy == actor.AccountId))
            throw GivingService.State("A reviewer who matched none of this month's lines closes it.");
        var existing = await records.ReadAsync<BankReconciliation>(Scope(parish), key, ct);
        if (existing?.Value.Status == "Closed")
            throw GivingService.State("This month is already reconciled.");
        var item = new BankReconciliation
        {
            Id = account + ":" + request.Period, ParishId = parish, BankAccount = account, Period = request.Period, LineCount = lines.Count,
            Totals = lines.GroupBy(l => l.Currency).ToDictionary(g => g.Key, g => g.Sum(l => l.Amount)),
            OutstandingLineIds = lines.Where(l => l.Status == "Outstanding").Select(l => l.Id).ToArray(), ReviewedBy = actor.AccountId, ReviewedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "bank.reconcile", item.Id,
            [Fence(root), existing is null ? RecordChange.Create(key, "bankReconciliation", item) : RecordChange.Replace(key, "bankReconciliation", item, existing.Version)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    // Reopening keeps the original reviewer and time and records who reopened it and why.
    public async Task<BankReconciliationDto> ReopenAsync(string parish, ReconcileBankDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var account = Account(request.BankAccount);
        var key = ReconciliationKey(account, request.Period);
        var op = actor.CreateOperation(request.OperationId, request, clock, "bank-reopen:v1:" + account + ":" + request.Period);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await records.ReadAsync<BankReconciliation>(Scope(parish), key, ct))!.Value);
        var row = await records.ReadAsync<BankReconciliation>(Scope(parish), key, ct);
        if (row?.Value.Status != "Closed")
            throw GivingService.State("Only a reconciled month can be reopened.");
        row.Value.Status = "Reopened";
        row.Value.ReopenedBy = actor.AccountId;
        row.Value.ReopenReason = Guard.Text(request.Reason, "Reason", 1000);
        await records.CommitAsync(Scope(parish), op, "bank.reopen", row.Value.Id, [Fence(root), RecordChange.Replace(key, "bankReconciliation", row.Value, row.Version)],
            new CommandResult { Id = row.Value.Id, Status = row.Value.Status }, ct);
        return Project(row.Value);
    }

    public async Task<IReadOnlyList<BankReconciliationDto>> ReconciliationsAsync(string parish, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        return (await records.CollectAsync<BankReconciliation>(Scope(parish), "bankReconciliation", ct, 2000)).Select(r => Project(r.Value))
            .OrderBy(r => r.BankAccount, StringComparer.Ordinal).ThenBy(r => r.Period, StringComparer.Ordinal).ToArray();
    }

    private async Task<List<BankAllocation>> AllocationsAsync(string parish, BankLine line, BankAllocationDto[] requested, List<RecordChange> changes, CancellationToken ct)
    {
        if (requested.Length == 0 || requested.Sum(a => a.Amount) != line.Amount)
            throw new DomainException("invalid_input", "Allocations must add up exactly to the line amount of " + line.Amount.ToString(CultureInfo.InvariantCulture) + " " + line.Currency + ".");
        // ponytail: scans the parish's bank lines for earlier allocations (cap 20000); keep a per-record allocation total if this grows.
        var allocated = (await records.CollectAsync<BankLine>(Scope(parish), "bankLine", ct, 20000)).Where(r => r.Value.Id != line.Id)
            .SelectMany(r => r.Value.Allocations).Where(a => a.RecordId is not null).GroupBy(a => a.Kind + ":" + a.RecordId).ToDictionary(g => g.Key, g => g.Sum(a => Math.Abs(a.Amount)));
        var result = new List<BankAllocation>();
        foreach (var a in requested)
        {
            if (a.Amount == 0 || decimal.Round(a.Amount, 2) != a.Amount)
                throw new DomainException("invalid_input", "Each allocation needs a non-zero amount with up to two decimals.");
            var item = new BankAllocation { Kind = a.Kind, Amount = a.Amount, Note = string.IsNullOrWhiteSpace(a.Note) ? null : Guard.Text(a.Note, "Note", 300) };
            switch (a.Kind)
            {
                case "Contribution" or "Expense":
                    item.RecordId = Guard.Text(a.RecordId, "Record", 64);
                    var (amount, currency, ok, key) = a.Kind == "Contribution"
                        ? await RecordAsync<Contribution>(parish, "contribution:" + item.RecordId, c => (c.Amount, c.Currency, c.Status == "Posted" && a.Amount > 0), changes, ct)
                        : await RecordAsync<Expense>(parish, "expense:" + item.RecordId, e => (e.Amount, e.Currency, e.Status == "Paid" && a.Amount < 0), changes, ct);
                    if (!ok || currency != line.Currency)
                        throw GivingService.State("Match deposits to posted gifts and withdrawals to paid expenses in the same currency.");
                    if (allocated.GetValueOrDefault(a.Kind + ":" + item.RecordId) + Math.Abs(a.Amount) > amount)
                        throw GivingService.State("That would allocate more than the recorded " + a.Kind.ToLowerInvariant() + " amount.");
                    break;
                case "Fee" when a.Amount < 0:
                    break;
                case "Other":
                    item.Note = item.Note ?? throw new DomainException("invalid_input", "Explain an Other allocation in its note.");
                    break;
                default:
                    throw new DomainException("invalid_input", "Bank fees are withdrawals (negative amounts).");
            }
            result.Add(item);
        }
        return result;
    }

    // Reads the matched record and fences it in the same transaction, so two concurrent matches cannot both use the same amount.
    private async Task<(decimal Amount, string Currency, bool Ok, string Key)> RecordAsync<T>(string parish, string key, Func<T, (decimal, string, bool)> read,
        List<RecordChange> changes, CancellationToken ct)
    {
        var row = await records.ReadAsync<T>(Scope(parish), key, ct)
            ?? throw new DomainException("resource_not_found", "The matched finance record is unavailable.", FailureKind.NotFound);
        if (!changes.Any(c => c.Id == key))
            changes.Add(RecordChange.Replace(key, key[..key.IndexOf(':')], row.Value!, row.Version));
        var (amount, currency, ok) = read(row.Value);
        return (amount, currency, ok, key);
    }

    private async Task<Versioned<BankLine>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<BankLine>(Scope(parish), "bankLine:" + id, ct) is { } row && row.Value.ParishId == parish ? row
            : throw new DomainException("resource_not_found", "The requested bank line is unavailable.", FailureKind.NotFound);

    private static BankLineDto Project(Versioned<BankLine> row) => new()
    {
        Id = row.Value.Id, Version = row.Version, BankAccount = row.Value.BankAccount, BatchId = row.Value.BatchId, PostedOn = row.Value.PostedOn,
        Reference = row.Value.Reference, Amount = row.Value.Amount, Currency = row.Value.Currency, Original = row.Value.Original, Status = row.Value.Status,
        Allocations = row.Value.Allocations.Select(a => new BankAllocationDto { Kind = a.Kind, RecordId = a.RecordId, Amount = a.Amount, Note = a.Note }).ToArray(),
        OutstandingReason = row.Value.OutstandingReason, MatchedBy = row.Value.MatchedBy, MatchedAt = row.Value.MatchedAt
    };

    private static BankReconciliationDto Project(BankReconciliation x) => new()
    {
        BankAccount = x.BankAccount, Period = x.Period, Status = x.Status, LineCount = x.LineCount, Totals = new(x.Totals), OutstandingLineIds = x.OutstandingLineIds,
        ReviewedBy = x.ReviewedBy, ReviewedAt = x.ReviewedAt, ReopenedBy = x.ReopenedBy, ReopenReason = x.ReopenReason
    };
}
