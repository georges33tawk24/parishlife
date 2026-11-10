// Purpose: manages parish expenses from draft through independent approval to recorded payment, and reports fund balances per currency.
// Main functions: SaveAsync, ActAsync, ListAsync and BalancesAsync. Entry, approval and payment recording are separate permissions and,
// for approval, a different person; a missing receipt needs an explicit reason and approval. Currencies are never combined.

using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Finance;

public class ExpenseService(IRecordTransactions records, GivingService giving, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "expense:" + id;
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    public async Task<ExpenseDto> SaveAsync(string parish, string? id, SaveExpenseDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "expense:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        GivingService.Money(request.Amount, request.Currency);
        Versioned<Expense>? old = id is null ? null : await ReadAsync(parish, id, ct);
        if (old is not null && old.Value.Status is not ("Draft" or "Returned"))
            throw GivingService.State("Only a draft or returned expense is edited.");
        var evidence = string.IsNullOrWhiteSpace(request.EvidenceReference) ? null : Guard.Text(request.EvidenceReference, "Evidence", 500);
        var missing = string.IsNullOrWhiteSpace(request.MissingEvidenceReason) ? null : Guard.Text(request.MissingEvidenceReason, "Missing-evidence reason", 1000);
        if (evidence is null == (missing is null))
            throw new DomainException("invalid_input", "Give the invoice/receipt reference, or the reason it is missing (not both).");
        var item = old?.Value ?? new Expense { Id = op.Id, ParishId = parish, CreatedBy = actor.AccountId };
        item.Description = Guard.Text(request.Description, "Description", 1000);
        item.FundId = (await giving.ActiveFundAsync(parish, Guard.Id(request.FundId), ct)).Id;
        item.Payee = Guard.Text(request.Payee, "Payee", 300);
        item.IncurredOn = request.IncurredOn;
        item.Amount = request.Amount;
        item.Currency = request.Currency;
        item.EvidenceReference = evidence;
        item.MissingEvidenceReason = missing;
        item.Status = "Draft";
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "finance.expense_save", item.Id,
            [Fence(root), old is null ? RecordChange.Create(Key(item.Id), "expense", item) : RecordChange.Replace(Key(item.Id), "expense", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<ExpenseDto> ActAsync(string parish, string id, ExpenseActionDto request, CancellationToken ct)
    {
        var permission = request.Action switch
        {
            "submit" or "cancel" => Permissions.FinanceEnter,
            "record-payment" => Permissions.FinancePost,
            _ => Permissions.FinanceApprove
        };
        var root = await giving.AuthorizeAsync(parish, permission, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "expense-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        var independent = item.CreatedBy != actor.AccountId && item.SubmittedBy != actor.AccountId;
        switch (request.Action)
        {
            case "submit" when item.Status is "Draft" or "Returned":
                item.SubmittedBy = actor.AccountId;
                item.Status = "Submitted";
                break;
            case "return" when item.Status == "Submitted" && independent:
            case "reject" when item.Status == "Submitted" && independent:
                item.Reason = Guard.Text(request.Reason, "Reason", 2000);
                item.Status = request.Action == "return" ? "Returned" : "Rejected";
                break;
            case "approve" when item.Status == "Submitted" && independent:
                // Approving an expense without a receipt is the named approver's explicit acceptance of that exception.
                item.MissingEvidenceApproved = item.MissingEvidenceReason is not null;
                item.ApprovedBy = actor.AccountId;
                item.Status = "Approved";
                break;
            case "cancel" when item.Status is "Draft" or "Submitted" or "Returned" or "Approved":
                item.Reason = Guard.Text(request.Reason, "Reason", 2000);
                item.Status = "Cancelled";
                break;
            case "record-payment" when item.Status == "Approved":
                if (request.PaidOn is not { } paid || paid > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime.AddHours(14)))
                    throw new DomainException("invalid_input", "Record the actual payment date; it cannot be in the future.");
                item.PaidOn = paid;
                item.PaymentReference = Guard.Text(request.PaymentReference, "Payment reference", 300);
                item.PaidBy = actor.AccountId;
                item.Status = "Paid";
                break;
            default:
                throw GivingService.State(request.Action is "approve" or "return" or "reject" && !independent
                    ? "A different person from the one who entered or submitted the expense decides it." : "This expense action is not available now.");
        }
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "finance.expense_" + request.Action.Replace('-', '_'), id,
            [Fence(root), RecordChange.Replace(Key(id), "expense", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<IReadOnlyList<Versioned<ExpenseDto>>> ListAsync(string parish, string? status, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var rows = status is null
            ? await records.CollectAsync<Expense>(Scope(parish), "expense", ct, 5000)
            : await records.CollectAsync<Expense>(Scope(parish), "expense", ct, 5000, new RecordCondition { Path = "status", Comparison = "eq", Value = Guard.Text(status, "Status", 30) });
        return rows.OrderByDescending(r => r.Value.UpdatedAt).Select(r => new Versioned<ExpenseDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    // Each fund shows one row per currency: posted gifts net of reversals minus paid expenses. No consolidated cash figure is invented.
    public async Task<IReadOnlyList<FundBalanceDto>> BalancesAsync(string parish, CancellationToken ct)
    {
        var funds = await giving.FundsAsync(parish, ct);
        var gifts = (await giving.AllContributionsAsync(parish, ct)).Select(r => r.Value).ToList();
        var paid = (await records.CollectAsync<Expense>(Scope(parish), "expense", ct, 5000, new RecordCondition { Path = "status", Comparison = "eq", Value = "Paid" }))
            .Select(r => r.Value).ToList();
        return funds.SelectMany(fund => gifts.Where(g => g.FundId == fund.Id).Select(g => g.Currency).Concat(paid.Where(e => e.FundId == fund.Id).Select(e => e.Currency))
                .Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).Select(currency =>
                {
                    var received = gifts.Where(g => g.FundId == fund.Id && g.Currency == currency).Sum(g => g.Amount);
                    var spent = paid.Where(e => e.FundId == fund.Id && e.Currency == currency).Sum(e => e.Amount);
                    return new FundBalanceDto { FundId = fund.Id, FundName = fund.Name, Currency = currency, Received = received, Paid = spent, Balance = received - spent };
                }))
            .ToArray();
    }

    private async Task<Versioned<Expense>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<Expense>(Scope(parish), Key(id), ct)
            ?? throw new DomainException("resource_not_found", "The requested expense is unavailable.", FailureKind.NotFound);
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw new DomainException("resource_not_found", "The requested expense is unavailable.", FailureKind.NotFound);
        return row;
    }

    private static ExpenseDto Project(Expense x) => new()
    {
        Id = x.Id, Description = x.Description, FundId = x.FundId, Payee = x.Payee, IncurredOn = x.IncurredOn, Amount = x.Amount, Currency = x.Currency,
        EvidenceReference = x.EvidenceReference, MissingEvidenceReason = x.MissingEvidenceReason, MissingEvidenceApproved = x.MissingEvidenceApproved,
        Status = x.Status, Reason = x.Reason, CreatedBy = x.CreatedBy, SubmittedBy = x.SubmittedBy, ApprovedBy = x.ApprovedBy, PaidBy = x.PaidBy,
        PaidOn = x.PaidOn, PaymentReference = x.PaymentReference
    };
}
