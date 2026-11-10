// Purpose: keeps the office's own cash ledger apart from parish Finance: one opening balance per currency, allowances (linked to the Finance
// record that moved the cash) and purchases, editable or removable only while their month is open, then reviewed monthly closes with
// carried-forward balances; closed months change only through reversal entries. Negative balances are flagged, never topped up.
// Main functions: OpenAsync, SaveAsync, ActAsync, EntriesAsync, CloseMonthAsync, MonthsAsync and BalancesAsync.

using System.Globalization;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Finance;

public class OfficeLedgerService(IRecordTransactions records, GivingService giving, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    private static string Period(DateOnly date) => date.ToString("yyyy-MM", CultureInfo.InvariantCulture);
    private static decimal Signed(OfficeLedgerEntry e, IReadOnlyDictionary<string, OfficeLedgerEntry> all)
        => e.Kind switch { "Allowance" => e.Amount, "Purchase" => -e.Amount, _ => all.TryGetValue(e.ReversalOf ?? "", out var o) ? -Signed(o, all) : 0 };

    public async Task<OfficeOpeningDto> OpenAsync(string parish, OfficeOpeningDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var key = "officeOpening:" + request.Currency;
        var op = actor.CreateOperation(request.OperationId, request, clock, "office-opening:v1:" + request.Currency);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return request;
        if (await records.ReadAsync<OfficeOpening>(Scope(parish), key, ct) is not null)
            throw GivingService.State("The opening balance for " + request.Currency + " was already entered; later months carry it forward.");
        if (request.Amount < 0 || decimal.Round(request.Amount, 2) != request.Amount)
            throw new DomainException("invalid_money", "Use an exact opening amount with at most two decimals.");
        await records.CommitAsync(Scope(parish), op, "office.opening", request.Currency,
            [Fence(root), RecordChange.Create(key, "officeOpening", new OfficeOpening
            {
                Currency = request.Currency, ParishId = parish, Amount = request.Amount, EffectiveOn = request.EffectiveOn,
                Provenance = Guard.Text(request.Provenance, "Provenance", 500), By = actor.AccountId, At = op.At
            })], new CommandResult { Id = request.Currency, Status = "Opened" }, ct);
        return request;
    }

    public async Task<OfficeEntryDto> SaveAsync(string parish, string? id, SaveOfficeEntryDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "office-entry:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await GetAsync(parish, prior.Id, ct);
        GivingService.Money(request.Amount, request.Currency);
        var opening = await records.ReadAsync<OfficeOpening>(Scope(parish), "officeOpening:" + request.Currency, ct)
            ?? throw GivingService.State("Enter the opening office balance for " + request.Currency + " first.");
        if (request.OccurredOn < opening.Value.EffectiveOn || request.OccurredOn > DateOnly.FromDateTime(op.At.UtcDateTime))
            throw new DomainException("invalid_input", "The date must be on or after the opening balance and not in the future.");
        await OpenMonthAsync(parish, request.OccurredOn, ct);
        Versioned<OfficeLedgerEntry>? old = null;
        if (id is not null)
        {
            old = await ReadAsync(parish, id, ct);
            if (old.Value.Kind == "Reversal" || old.Value.Status != "Active")
                throw GivingService.State("Only an active allowance or purchase can be edited.");
            await OpenMonthAsync(parish, old.Value.OccurredOn, ct);
        }
        var item = new OfficeLedgerEntry
        {
            Id = id ?? op.Id, ParishId = parish, Kind = request.Kind, OccurredOn = request.OccurredOn, Amount = request.Amount, Currency = request.Currency,
            Description = Guard.Text(request.Description, "Description", 300), CreatedBy = old?.Value.CreatedBy ?? actor.AccountId, UpdatedAt = op.At
        };
        if (item.Kind == "Purchase")
        {
            item.Supplier = Guard.Text(request.Supplier, "Supplier", 200);
            item.EvidenceReference = string.IsNullOrWhiteSpace(request.EvidenceReference) ? null : Guard.Text(request.EvidenceReference, "Receipt reference", 300);
            item.MissingEvidenceReason = item.EvidenceReference is null ? Guard.Text(request.MissingEvidenceReason, "Reason the receipt is missing", 500) : null;
        }
        else
            item.FinanceReference = Guard.Text(request.FinanceReference, "Finance record of the transfer", 100);
        await records.CommitAsync(Scope(parish), op, "office.entry", item.Id,
            [Fence(root), old is null ? RecordChange.Create("officeEntry:" + item.Id, "officeEntry", item)
                : RecordChange.Replace("officeEntry:" + item.Id, "officeEntry", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await GetAsync(parish, item.Id, ct);
    }

    // Open months: remove (kept as Removed with a reason). Closed months: reverse with a new entry dated in an open month.
    public async Task<OfficeEntryDto> ActAsync(string parish, string id, OfficeEntryActionDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "office-entry-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await GetAsync(parish, prior.Id, ct);
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        if (item.Status != "Active")
            throw GivingService.State("This entry was already removed.");
        var closed = await records.ReadAsync<OfficeMonth>(Scope(parish), "officeMonth:" + Period(item.OccurredOn), ct) is not null;
        var reason = Guard.Text(request.Reason, "Reason", 500);
        if (request.Action == "remove")
        {
            if (closed)
                throw GivingService.State("This entry's month is closed; reverse it instead.");
            item.Status = "Removed";
            item.DeleteReason = reason;
            item.UpdatedAt = op.At;
            await records.CommitAsync(Scope(parish), op, "office.remove", id, [Fence(root), RecordChange.Replace("officeEntry:" + id, "officeEntry", item, Versions.Require(request.Version))],
                new CommandResult { Id = id, Status = item.Status }, ct);
            return await GetAsync(parish, id, ct);
        }
        if (!closed)
            throw GivingService.State("This entry's month is still open; edit or remove it instead.");
        if (item.Kind == "Reversal" || (await EntriesRawAsync(parish, ct)).Any(e => e.ReversalOf == id && e.Status == "Active"))
            throw GivingService.State("This entry is a reversal or was already reversed.");
        var on = request.OccurredOn ?? DateOnly.FromDateTime(op.At.UtcDateTime);
        await OpenMonthAsync(parish, on, ct);
        var reversal = new OfficeLedgerEntry
        {
            Id = op.Id, ParishId = parish, Kind = "Reversal", OccurredOn = on, Amount = item.Amount, Currency = item.Currency, Description = "Reversal: " + reason,
            ReversalOf = id, CreatedBy = actor.AccountId, UpdatedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "office.reverse", id,
            [Fence(root), RecordChange.Replace("officeEntry:" + id, "officeEntry", item, Versions.Require(request.Version)), RecordChange.Create("officeEntry:" + reversal.Id, "officeEntry", reversal)],
            new CommandResult { Id = reversal.Id, Status = reversal.Status }, ct);
        return await GetAsync(parish, reversal.Id, ct);
    }

    public async Task<IReadOnlyList<OfficeEntryDto>> EntriesAsync(string parish, string? period, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var closed = (await records.CollectAsync<OfficeMonth>(Scope(parish), "officeMonth", ct, 1000)).Select(m => m.Value.Period).ToHashSet(StringComparer.Ordinal);
        return (await records.CollectAsync<OfficeLedgerEntry>(Scope(parish), "officeEntry", ct, 20000))
            .Where(r => period is null || Period(r.Value.OccurredOn) == period).OrderBy(r => r.Value.OccurredOn).ThenBy(r => r.Value.UpdatedAt)
            .Select(r => Project(r, closed.Contains(Period(r.Value.OccurredOn)))).ToArray();
    }

    // A different person from everyone who entered the month's lines closes it; earlier months with entries must be closed first.
    public async Task<OfficeMonthDto> CloseMonthAsync(string parish, CloseOfficeMonthDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var key = "officeMonth:" + request.Period;
        var op = actor.CreateOperation(request.OperationId, request, clock, "office-close:v1:" + request.Period);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await records.ReadAsync<OfficeMonth>(Scope(parish), key, ct))!.Value);
        if (await records.ReadAsync<OfficeMonth>(Scope(parish), key, ct) is not null)
            throw GivingService.State("This month is already closed.");
        var entries = (await EntriesRawAsync(parish, ct)).Where(e => e.Status == "Active").ToList();
        var closed = (await records.CollectAsync<OfficeMonth>(Scope(parish), "officeMonth", ct, 1000)).Select(m => m.Value.Period).ToHashSet(StringComparer.Ordinal);
        if (entries.Any(e => string.CompareOrdinal(Period(e.OccurredOn), request.Period) < 0 && !closed.Contains(Period(e.OccurredOn))))
            throw GivingService.State("Close the earlier months that have entries first.");
        var month = entries.Where(e => Period(e.OccurredOn) == request.Period).ToList();
        if (month.Any(e => e.CreatedBy == actor.AccountId))
            throw GivingService.State("A reviewer who entered none of this month's lines closes it.");
        var item = new OfficeMonth
        {
            Period = request.Period, ParishId = parish, Totals = await TotalsAsync(parish, request.Period, ct), ClosedBy = actor.AccountId, ClosedAt = op.At
        };
        item.NegativeCurrencies = item.Totals.Where(t => t.Value.Closing < 0).Select(t => t.Key).ToArray();
        await records.CommitAsync(Scope(parish), op, "office.close", request.Period, [Fence(root), RecordChange.Create(key, "officeMonth", item)],
            new CommandResult { Id = request.Period, Status = "Closed" }, ct);
        return Project(item);
    }

    public async Task<IReadOnlyList<OfficeMonthDto>> MonthsAsync(string parish, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        return (await records.CollectAsync<OfficeMonth>(Scope(parish), "officeMonth", ct, 1000)).Select(m => Project(m.Value)).OrderBy(m => m.Period, StringComparer.Ordinal).ToArray();
    }

    public async Task<OfficeMonthDto> BalancesAsync(string parish, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var period = Period(DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime));
        var totals = await TotalsAsync(parish, period, ct);
        return new OfficeMonthDto { Period = period, Totals = totals, NegativeCurrencies = totals.Where(t => t.Value.Closing < 0).Select(t => t.Key).ToArray() };
    }

    private async Task<Dictionary<string, OfficeMonthTotal>> TotalsAsync(string parish, string period, CancellationToken ct)
    {
        var all = (await EntriesRawAsync(parish, ct)).ToDictionary(e => e.Id, StringComparer.Ordinal);
        var active = all.Values.Where(e => e.Status == "Active").ToList();
        var result = new Dictionary<string, OfficeMonthTotal>(StringComparer.Ordinal);
        foreach (var opening in await records.CollectAsync<OfficeOpening>(Scope(parish), "officeOpening", ct, 50))
        {
            var currency = opening.Value.Currency;
            var before = active.Where(e => e.Currency == currency && string.CompareOrdinal(Period(e.OccurredOn), period) < 0).Sum(e => Signed(e, all));
            var during = active.Where(e => e.Currency == currency && Period(e.OccurredOn) == period).Select(e => Signed(e, all)).ToList();
            var start = opening.Value.Amount + before;
            result[currency] = new OfficeMonthTotal
            {
                Opening = start, In = during.Where(v => v > 0).Sum(), Out = -during.Where(v => v < 0).Sum(), Closing = start + during.Sum()
            };
        }
        return result;
    }

    private async Task OpenMonthAsync(string parish, DateOnly date, CancellationToken ct)
    {
        if (await records.ReadAsync<OfficeMonth>(Scope(parish), "officeMonth:" + Period(date), ct) is not null)
            throw GivingService.State("The month " + Period(date) + " is closed; use a reversal dated in an open month.");
    }

    private async Task<List<OfficeLedgerEntry>> EntriesRawAsync(string parish, CancellationToken ct)
        => (await records.CollectAsync<OfficeLedgerEntry>(Scope(parish), "officeEntry", ct, 20000)).Select(r => r.Value).ToList();

    private async Task<Versioned<OfficeLedgerEntry>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<OfficeLedgerEntry>(Scope(parish), "officeEntry:" + id, ct) is { } row && row.Value.ParishId == parish ? row
            : throw new DomainException("resource_not_found", "The requested office entry is unavailable.", FailureKind.NotFound);

    private async Task<OfficeEntryDto> GetAsync(string parish, string id, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        return Project(row, await records.ReadAsync<OfficeMonth>(Scope(parish), "officeMonth:" + Period(row.Value.OccurredOn), ct) is not null);
    }

    private static OfficeEntryDto Project(Versioned<OfficeLedgerEntry> row, bool closed) => new()
    {
        Id = row.Value.Id, Version = row.Version, Kind = row.Value.Kind, OccurredOn = row.Value.OccurredOn, Amount = row.Value.Amount, Currency = row.Value.Currency,
        Description = row.Value.Description, Supplier = row.Value.Supplier, EvidenceReference = row.Value.EvidenceReference,
        MissingEvidenceReason = row.Value.MissingEvidenceReason, FinanceReference = row.Value.FinanceReference, ReversalOf = row.Value.ReversalOf,
        Status = row.Value.Status, DeleteReason = row.Value.DeleteReason, CreatedBy = row.Value.CreatedBy, MonthClosed = closed
    };

    private static OfficeMonthDto Project(OfficeMonth x)
        => new() { Period = x.Period, Totals = new(x.Totals), NegativeCurrencies = x.NegativeCurrencies, ClosedBy = x.ClosedBy, ClosedAt = x.ClosedAt };
}
