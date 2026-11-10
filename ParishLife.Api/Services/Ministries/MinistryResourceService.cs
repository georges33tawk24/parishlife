// Purpose: manages a ministry's counted physical belongings and their loans from request through issue, return, condition check and close.
// Main functions: SaveStockAsync, ListStockAsync, AvailableStockAsync, RequestAsync, ActAsync, GetAsync, ListAsync, OwnAsync and HistoryAsync;
// helpers enforce custody duty, current membership, stock reconciliation and safe projections. Digital files are not loans.
// Every issue/return/missing report replaces the stock record conditionally, so two loans cannot take the last unit.

using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public class MinistryResourceService(IRecordTransactions records, MinistryAccess access, ICurrentActor actor, TimeProvider clock)
{
    private static string StockKey(string id) => "ministryStock:" + id;
    private static string LoanKey(string id) => "ministryLoan:" + id;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException State(string message) => new("invalid_loan_state", message, FailureKind.Conflict);

    public async Task<MinistryStockDto> SaveStockAsync(string parish, string ministry, string? stock, SaveStockDto request, CancellationToken ct)
    {
        var group = await access.RequireCustodyAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-stock:v1:" + ministry + ":" + (stock ?? "new"));
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } prior)
            return Project((await ReadStockAsync(parish, ministry, prior.Id, ct)).Value);
        if (group.Value.Status != "Active")
            throw State("Belongings are managed for an active ministry.");
        var name = Guard.Text(request.Name, "Item name", 500);
        var storage = string.IsNullOrWhiteSpace(request.Storage) ? null : Guard.Text(request.Storage, "Storage", 500);
        if (request.Total is < 0 or > 100000 || request.Status is not ("Active" or "Retired"))
            throw new DomainException("invalid_input", "Use a total of 0–100000 and Active or Retired.");
        RecordChange change;
        MinistryStock item;
        if (stock is null)
        {
            if (request.Version is not null || request.Status != "Active")
                throw State("New stock starts Active and has no version.");
            item = new MinistryStock { Id = op.Id, ParishId = parish, MinistryId = ministry, OnLoan = 0 };
            change = RecordChange.Create(StockKey(item.Id), "ministryStock", item);
        }
        else
        {
            var row = await ReadStockAsync(parish, ministry, stock, ct);
            item = row.Value;
            // Units out on loan are reconciled by returns or explicit missing reports, never by editing the total below them.
            if (request.Total < item.OnLoan)
                throw State("The total cannot be lower than the units currently on loan.");
            change = RecordChange.Replace(StockKey(item.Id), "ministryStock", item, Versions.Require(request.Version));
        }
        item.Name = name;
        item.Storage = storage;
        item.Total = request.Total;
        item.Status = request.Status;
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(scope, op, "ministry.stock_save", ministry, [MinistryAccess.Fence(root), change],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<Page<Versioned<MinistryStockDto>>> ListStockAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireCustodyAsync(parish, ministry, ct, readOnly: true);
        var page = await records.PageAsync<MinistryStock>(MinistryAccess.Scope(parish), "ministryStock", size, cursor, ct, Equal("ministryId", ministry));
        return StockPage(page);
    }

    // Current members see active belongings they may request; storage locations stay with custodians.
    public async Task<Page<Versioned<MinistryStockDto>>> AvailableStockAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        var link = await access.OwnLinkAsync(parish, ct);
        if (!await access.IsCurrentMemberAsync(parish, ministry, link.Value.PersonId, clock.GetUtcNow(), ct))
            throw MinistryAccess.Missing();
        var page = await records.PageAsync<MinistryStock>(MinistryAccess.Scope(parish), "ministryStock", size, cursor, ct,
            Equal("ministryId", ministry), Equal("status", "Active"));
        var result = StockPage(page);
        foreach (var row in result.Items)
            row.Value.Storage = null;
        return result;
    }

    public async Task<MinistryLoanDto> RequestAsync(string parish, string ministry, RequestLoanDto request, CancellationToken ct)
    {
        string person;
        var own = request.PersonId is null;
        if (own)
            person = (await access.OwnLinkAsync(parish, ct)).Value.PersonId;
        else
        {
            await access.RequireCustodyAsync(parish, ministry, ct);
            person = Guard.Id(request.PersonId!.Value);
        }
        var root = await access.RootAsync(parish, ct);
        var group = await access.ReadAsync(parish, ministry, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-loan:v1:" + ministry);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } prior)
            return await CurrentAsync(parish, ministry, prior.Id, !own, ct);
        var stock = await ReadStockAsync(parish, ministry, Guard.Id(request.StockId), ct);
        if (group.Value.Status != "Active" || stock.Value.Status != "Active")
            throw State("Requests need an active ministry and active stock.");
        if (request.Quantity < 1 || request.Quantity > stock.Value.Total)
            throw State("Request between one unit and the total stock.");
        if (!await access.IsCurrentMemberAsync(parish, ministry, person, op.At, ct))
            throw State("Only a current, unarchived ministry member can borrow group belongings.");
        var item = new MinistryLoan
        {
            Id = op.Id, ParishId = parish, MinistryId = ministry, StockId = stock.Value.Id, PersonId = person, Quantity = request.Quantity,
            Purpose = string.IsNullOrWhiteSpace(request.Purpose) ? null : Guard.Text(request.Purpose, "Purpose", 1000),
            RequestedBy = actor.AccountId, RequestedAt = op.At
        };
        await records.CommitAsync(scope, op, "ministry.loan_request", ministry,
            [MinistryAccess.Fence(root), RecordChange.Create(LoanKey(item.Id), "ministryLoan", item), History(item, "request", "", null, op, null)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, stock.Value, !own, op.At);
    }

    public async Task<MinistryLoanDto> ActAsync(string parish, string ministry, string loan, LoanActionDto request, CancellationToken ct)
    {
        var row = await ReadLoanAsync(parish, ministry, loan, ct);
        var item = row.Value;
        var own = request.Action == "cancel" && await IsOwnAsync(parish, item.PersonId, ct);
        if (!own)
            await access.RequireCustodyAsync(parish, ministry, ct);
        var root = await access.RootAsync(parish, ct);
        var group = await access.ReadAsync(parish, ministry, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-loan-action:v1:" + loan);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return await CurrentAsync(parish, ministry, loan, !own, ct);
        var stock = await ReadStockAsync(parish, ministry, item.StockId, ct);
        var available = stock.Value.Total - stock.Value.OnLoan;
        var previous = Copy(item);
        var stockChanged = false;
        string? reason = null;
        switch (request.Action)
        {
            case "approve" when item.Status == "Requested":
                if (group.Value.Status != "Active" || stock.Value.Status != "Active" || available < item.Quantity)
                    throw State("Not enough serviceable stock is available to approve this request.");
                item.Status = "Approved";
                item.DecidedBy = actor.AccountId;
                break;
            case "decline" when item.Status is "Requested" or "Approved":
                item.Reason = reason = Guard.Text(request.Reason, "Decline reason", 2000);
                item.Status = "Declined";
                item.DecidedBy = actor.AccountId;
                break;
            case "cancel" when item.Status == "Requested":
                item.Reason = reason = Guard.Text(request.Reason, "Cancellation reason", 2000);
                item.Status = "Cancelled";
                break;
            case "issue" when item.Status == "Approved":
                if (group.Value.Status != "Active" || stock.Value.Status != "Active" || available < item.Quantity)
                    throw State("Not enough serviceable stock is available to issue this loan.");
                if (!await access.IsCurrentMemberAsync(parish, ministry, item.PersonId, op.At, ct))
                    throw State("Only a current, unarchived ministry member can receive a loan.");
                if (request.DueAt is not { } due || Guard.Utc(due) <= op.At)
                    throw new DomainException("invalid_input", "A future UTC due date is required.");
                item.DueAt = due;
                item.IssueCondition = Guard.Text(request.Condition, "Condition at issue", 500);
                item.IssuedAt = op.At;
                item.IssuedBy = actor.AccountId;
                item.Status = "Issued";
                stock.Value.OnLoan += item.Quantity;
                stockChanged = true;
                break;
            case "return" when item.Status == "Issued":
                // A departed member keeps this limited return route; returns do not depend on current membership.
                item.ReturnCondition = Guard.Text(request.Condition, "Condition at return", 500);
                item.ReturnedAt = op.At;
                item.ReturnedTo = actor.AccountId;
                item.Status = "Returned";
                stock.Value.OnLoan -= item.Quantity;
                stockChanged = true;
                break;
            case "check" when item.Status == "Returned":
                item.Outcome = request.Outcome ?? throw new DomainException("invalid_input", "Record the outcome as Good or Damaged.");
                if (item.Outcome == "Damaged")
                {
                    item.ConditionEvidence = Guard.Text(request.Evidence, "Damage evidence", 1000);
                    item.FollowUpRequired = true;
                }
                item.Status = "ConditionChecked";
                break;
            case "report-missing" when item.Status == "Issued":
                // An explicit, attributed loss record reduces the counted stock; nothing is silently deleted or charged.
                item.ConditionEvidence = Guard.Text(request.Evidence, "Missing-item evidence", 1000);
                item.Reason = reason = Guard.Text(request.Reason, "Missing-item explanation", 2000);
                item.Outcome = "Missing";
                item.FollowUpRequired = true;
                item.Status = "ConditionChecked";
                stock.Value.OnLoan -= item.Quantity;
                stock.Value.Total -= item.Quantity;
                stockChanged = true;
                break;
            case "close" when item.Status == "ConditionChecked":
                if (item.FollowUpRequired)
                    item.FollowUpResolution = reason = Guard.Text(request.Reason, "Follow-up resolution", 2000);
                item.Status = "Closed";
                break;
            default:
                throw State("This loan action is not available in its current state.");
        }
        var changes = new List<RecordChange>
        {
            MinistryAccess.Fence(root),
            RecordChange.Replace(LoanKey(item.Id), "ministryLoan", item, Versions.Require(request.Version)),
            History(item, request.Action, previous.Status, previous, op, reason)
        };
        if (stockChanged)
        {
            stock.Value.UpdatedBy = actor.AccountId;
            stock.Value.UpdatedAt = op.At;
            changes.Add(RecordChange.Replace(StockKey(stock.Value.Id), "ministryStock", stock.Value, stock.Version));
        }
        await records.CommitAsync(scope, op, "ministry.loan_" + request.Action.Replace('-', '_'), ministry, changes,
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item, stock.Value, !own, op.At);
    }

    public async Task<Versioned<MinistryLoanDto>> GetAsync(string parish, string ministry, string loan, CancellationToken ct)
    {
        await access.RequireCustodyAsync(parish, ministry, ct, readOnly: true);
        var row = await ReadLoanAsync(parish, ministry, loan, ct);
        var stock = await ReadStockAsync(parish, ministry, row.Value.StockId, ct);
        return new Versioned<MinistryLoanDto> { Version = row.Version, Value = Project(row.Value, stock.Value, true, clock.GetUtcNow()) };
    }

    public async Task<Page<Versioned<MinistryLoanDto>>> ListAsync(string parish, string ministry, string? status, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireCustodyAsync(parish, ministry, ct, readOnly: true);
        RecordCondition[] conditions = status is null ? [Equal("ministryId", ministry)] : [Equal("ministryId", ministry), Equal("status", Guard.Text(status, "Status", 30))];
        var page = await records.PageAsync<MinistryLoan>(MinistryAccess.Scope(parish), "ministryLoan", size, cursor, ct, conditions);
        return await ProjectPageAsync(parish, ministry, page, true, ct);
    }

    // Own loans stay visible after departure so outstanding items can still be returned.
    public async Task<Page<Versioned<MinistryLoanDto>>> OwnAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        var link = await access.OwnLinkAsync(parish, ct);
        await access.ReadAsync(parish, ministry, ct);
        var page = await records.PageAsync<MinistryLoan>(MinistryAccess.Scope(parish), "ministryLoan", size, cursor, ct,
            Equal("ministryId", ministry), Equal("personId", link.Value.PersonId));
        return await ProjectPageAsync(parish, ministry, page, false, ct);
    }

    public async Task<Page<MinistryLoanHistoryDto>> HistoryAsync(string parish, string ministry, string person, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireCustodyAsync(parish, ministry, ct, readOnly: true);
        var page = await records.PageAsync<MinistryLoanHistory>(MinistryAccess.Scope(parish), "ministryLoanChange", size, cursor, ct,
            Equal("ministryId", ministry), Equal("personId", person));
        var stocks = new Dictionary<string, MinistryStock>(StringComparer.Ordinal);
        var items = new List<MinistryLoanHistoryDto>();
        foreach (var row in page.Items)
            items.Add(new MinistryLoanHistoryDto
            {
                Id = row.Value.Id, LoanId = row.Value.LoanId, Action = row.Value.Action, FromStatus = row.Value.FromStatus, ToStatus = row.Value.ToStatus,
                RecordedBy = row.Value.RecordedBy, RecordedAt = row.Value.RecordedAt, Reason = row.Value.Reason,
                Previous = row.Value.Previous is null ? null
                    : Project(row.Value.Previous, await CachedStockAsync(parish, ministry, row.Value.Previous.StockId, stocks, ct), true, row.Value.RecordedAt)
            });
        return new Page<MinistryLoanHistoryDto> { Items = items, ContinuationToken = page.ContinuationToken };
    }

    private async Task<bool> IsOwnAsync(string parish, string person, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
            return false;
        try { return (await access.OwnLinkAsync(parish, ct)).Value.PersonId == person; }
        catch (DomainException error) when (error.Kind == FailureKind.NotFound) { return false; }
    }

    private async Task<Versioned<MinistryStock>> ReadStockAsync(string parish, string ministry, string stock, CancellationToken ct)
    {
        var row = await records.ReadAsync<MinistryStock>(MinistryAccess.Scope(parish), StockKey(stock), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != stock || row.Value.MinistryId != ministry || row.Value.ParishId != parish)
            throw MinistryAccess.Missing();
        return row;
    }

    private async Task<Versioned<MinistryLoan>> ReadLoanAsync(string parish, string ministry, string loan, CancellationToken ct)
    {
        var row = await records.ReadAsync<MinistryLoan>(MinistryAccess.Scope(parish), LoanKey(loan), ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != loan || row.Value.MinistryId != ministry || row.Value.ParishId != parish)
            throw MinistryAccess.Missing();
        return row;
    }

    private async Task<MinistryStock> CachedStockAsync(string parish, string ministry, string stock, Dictionary<string, MinistryStock> cache, CancellationToken ct)
    {
        if (!cache.TryGetValue(stock, out var value))
            cache[stock] = value = (await ReadStockAsync(parish, ministry, stock, ct)).Value;
        return value;
    }

    private async Task<MinistryLoanDto> CurrentAsync(string parish, string ministry, string loan, bool privileged, CancellationToken ct)
    {
        var row = await ReadLoanAsync(parish, ministry, loan, ct);
        return Project(row.Value, (await ReadStockAsync(parish, ministry, row.Value.StockId, ct)).Value, privileged, clock.GetUtcNow());
    }

    private async Task<Page<Versioned<MinistryLoanDto>>> ProjectPageAsync(string parish, string ministry, Page<Versioned<MinistryLoan>> page,
        bool privileged, CancellationToken ct)
    {
        var stocks = new Dictionary<string, MinistryStock>(StringComparer.Ordinal);
        var items = new List<Versioned<MinistryLoanDto>>();
        foreach (var row in page.Items)
            items.Add(new Versioned<MinistryLoanDto>
            {
                Version = row.Version,
                Value = Project(row.Value, await CachedStockAsync(parish, ministry, row.Value.StockId, stocks, ct), privileged, clock.GetUtcNow())
            });
        return new Page<Versioned<MinistryLoanDto>> { Items = items, ContinuationToken = page.ContinuationToken };
    }

    private static Page<Versioned<MinistryStockDto>> StockPage(Page<Versioned<MinistryStock>> page) => new()
    {
        Items = page.Items.Select(row => new Versioned<MinistryStockDto> { Version = row.Version, Value = Project(row.Value) }).ToArray(),
        ContinuationToken = page.ContinuationToken
    };

    private RecordChange History(MinistryLoan item, string action, string from, MinistryLoan? previous, Operation op, string? reason)
        => RecordChange.Create("ministryLoanChange:" + op.Id, "ministryLoanChange", new MinistryLoanHistory
        {
            Id = op.Id, MinistryId = item.MinistryId, PersonId = item.PersonId, LoanId = item.Id, Action = action, FromStatus = from,
            ToStatus = item.Status, RecordedBy = actor.AccountId, RecordedAt = op.At, Reason = reason, Previous = previous
        });

    private static MinistryLoan Copy(MinistryLoan x) => new()
    {
        Id = x.Id, ParishId = x.ParishId, MinistryId = x.MinistryId, StockId = x.StockId, PersonId = x.PersonId, Quantity = x.Quantity,
        Status = x.Status, Purpose = x.Purpose, RequestedBy = x.RequestedBy, RequestedAt = x.RequestedAt, DecidedBy = x.DecidedBy,
        IssuedAt = x.IssuedAt, IssuedBy = x.IssuedBy, DueAt = x.DueAt, IssueCondition = x.IssueCondition, ReturnedAt = x.ReturnedAt,
        ReturnedTo = x.ReturnedTo, ReturnCondition = x.ReturnCondition, Outcome = x.Outcome, ConditionEvidence = x.ConditionEvidence, FollowUpRequired = x.FollowUpRequired,
        FollowUpResolution = x.FollowUpResolution, Reason = x.Reason
    };

    private static MinistryStockDto Project(MinistryStock x) => new()
    {
        Id = x.Id, MinistryId = x.MinistryId, Name = x.Name, Storage = x.Storage, Total = x.Total, OnLoan = x.OnLoan,
        Available = Math.Max(0, x.Total - x.OnLoan), Status = x.Status, UpdatedBy = x.UpdatedBy, UpdatedAt = x.UpdatedAt
    };

    // Own projections show the borrower's loan, dates and outcome; actors, evidence and condition notes stay with custodians.
    private static MinistryLoanDto Project(MinistryLoan x, MinistryStock stock, bool privileged, DateTimeOffset now) => new()
    {
        Id = x.Id, MinistryId = x.MinistryId, StockId = x.StockId, StockName = stock.Name, PersonId = x.PersonId, Quantity = x.Quantity,
        Status = x.Status, Overdue = x.Status == "Issued" && x.DueAt < now, Purpose = x.Purpose, RequestedAt = x.RequestedAt,
        IssuedAt = x.IssuedAt, DueAt = x.DueAt, ReturnedAt = x.ReturnedAt, Outcome = x.Outcome, FollowUpRequired = x.FollowUpRequired, Reason = x.Reason,
        RequestedBy = privileged ? x.RequestedBy : null, DecidedBy = privileged ? x.DecidedBy : null, IssuedBy = privileged ? x.IssuedBy : null,
        ReturnedTo = privileged ? x.ReturnedTo : null, ReturnCondition = privileged ? x.ReturnCondition : null, IssueCondition = privileged ? x.IssueCondition : null,
        ConditionEvidence = privileged ? x.ConditionEvidence : null, FollowUpResolution = privileged ? x.FollowUpResolution : null
    };
}
