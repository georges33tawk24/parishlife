// Purpose: keeps the budget an authorized office set for each fund, calendar year and currency, and compares it with what was actually
// paid from that fund in that year and currency. Budgets are never converted between currencies or invented; a fund without one has none.
// Main functions: SaveAsync (create, or replace with the current version) and ListAsync.

using System.Globalization;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Finance;

public class FundBudgetService(IRecordTransactions records, GivingService giving, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    private static string Id(string fund, int year, string currency) => fund + "-" + year.ToString(CultureInfo.InvariantCulture) + "-" + currency;

    public async Task<FundBudgetDto> SaveAsync(string parish, SaveFundBudgetDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var fundId = Guard.Id(request.FundId);
        var id = Id(fundId, request.Year, request.Currency);
        var op = actor.CreateOperation(request.OperationId, request, clock, "fund-budget:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is null)
        {
            GivingService.Money(request.Amount, request.Currency);
            if (request.Year is < 2000 or > 2100)
                throw new DomainException("invalid_input", "Use a calendar year between 2000 and 2100.");
            var fund = await giving.ActiveFundAsync(parish, fundId, ct);
            var old = await records.ReadAsync<FundBudget>(Scope(parish), "fundBudget:" + id, ct);
            // Setting a budget that already exists replaces it only from the version the editor saw; two first settings cannot both win.
            if (old is not null && string.IsNullOrWhiteSpace(request.Version))
                throw new DomainException("write_conflict", "A budget already exists for this fund, year and currency; edit it from its current version.", FailureKind.Conflict);
            var item = new FundBudget
            {
                Id = id, ParishId = parish, FundId = fund.Id, Year = request.Year, Currency = request.Currency, Amount = request.Amount,
                Note = GivingService.Optional(request.Note, "Note", 500), SetBy = actor.AccountId, SetAt = op.At
            };
            await records.CommitAsync(Scope(parish), op, "finance.budget_set", id,
                [Fence(root), old is null ? RecordChange.Create("fundBudget:" + id, "fundBudget", item) : RecordChange.Replace("fundBudget:" + id, "fundBudget", item, Versions.Require(request.Version))],
                new CommandResult { Id = id, Status = "Set" }, ct);
        }
        var row = await records.ReadAsync<FundBudget>(Scope(parish), "fundBudget:" + id, ct)
            ?? throw new DomainException("resource_not_found", "The requested budget is unavailable.", FailureKind.NotFound);
        return (await ProjectAsync(parish, [row], ct)).Single();
    }

    public async Task<IReadOnlyList<FundBudgetDto>> ListAsync(string parish, int? year, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var rows = (await records.CollectAsync<FundBudget>(Scope(parish), "fundBudget", ct, 5000))
            .Where(r => r.Value.ParishId == parish && (year is null || r.Value.Year == year)).ToList();
        return (await ProjectAsync(parish, rows, ct)).OrderBy(b => b.Year).ThenBy(b => b.FundId, StringComparer.Ordinal).ThenBy(b => b.Currency, StringComparer.Ordinal).ToArray();
    }

    // Spent counts paid expenses of the same fund and currency whose payment date falls in the budget year.
    private async Task<IEnumerable<FundBudgetDto>> ProjectAsync(string parish, IReadOnlyList<Versioned<FundBudget>> rows, CancellationToken ct)
    {
        var paid = rows.Count == 0 ? [] : (await records.CollectAsync<Expense>(Scope(parish), "expense", ct, 5000,
            new RecordCondition { Path = "status", Comparison = "eq", Value = "Paid" })).Select(r => r.Value).ToList();
        return rows.Select(r =>
        {
            var b = r.Value;
            var spent = paid.Where(e => e.FundId == b.FundId && e.Currency == b.Currency && e.PaidOn?.Year == b.Year).Sum(e => e.Amount);
            return new FundBudgetDto
            {
                Id = b.Id, Version = r.Version, FundId = b.FundId, Year = b.Year, Currency = b.Currency, Amount = b.Amount, Spent = spent, Remaining = b.Amount - spent,
                Note = b.Note, SetBy = b.SetBy, SetAt = b.SetAt
            };
        });
    }
}
