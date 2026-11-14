// Purpose: records standing intentions to give (a person or household, a fund, an amount in its own currency and a schedule) and their
// pause/resume/end. It is a stored schedule only: nothing is charged, collected or marked as paid; a gift counts only when it is actually
// received, counted and posted in a counting session.
// Main functions: SaveAsync (create or edit with the current version), ActAsync (pause, resume, end) and ListAsync.

using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Finance;

public class RecurringGiftService(IRecordTransactions records, GivingService giving, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    private static string Key(string id) => "recurringGift:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested recurring gift is unavailable.", FailureKind.NotFound);

    public async Task<RecurringGiftDto> SaveAsync(string parish, string? id, SaveRecurringGiftDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "recurring-gift:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project(await ReadAsync(parish, prior.Id, ct), Today());
        GivingService.Money(request.Amount, request.Currency);
        if (request.PersonId is null && request.HouseholdId is null)
            throw new DomainException("invalid_input", "A recurring gift belongs to a person or a household.");
        if (request.StartsOn == default || request.EndsOn < request.StartsOn)
            throw new DomainException("invalid_input", "Give a start date, and an end on or after it.");
        if (request.Frequency is not ("Weekly" or "Monthly" or "Quarterly" or "Yearly") || request.Method is not ("Cash" or "Bank" or "Cheque" or "Card" or "Other"))
            throw new DomainException("invalid_input", "Use Weekly, Monthly, Quarterly or Yearly, and Cash, Bank, Cheque, Card or Other.");
        Versioned<RecurringGift>? old = id is null ? null : await ReadAsync(parish, id, ct);
        if (old is not null && old.Value.Status == "Ended")
            throw GivingService.State("An ended recurring gift is kept as it was; record a new one instead.");
        var item = old?.Value ?? new RecurringGift { Id = op.Id, ParishId = parish, CreatedBy = actor.AccountId, CreatedAt = op.At };
        item.PersonId = request.PersonId is { } p ? await giving.PersonAsync(parish, Guard.Id(p), ct) : null;
        item.HouseholdId = request.HouseholdId is { } h ? await HouseholdAsync(parish, Guard.Id(h), ct) : null;
        item.FundId = (await giving.ActiveFundAsync(parish, Guard.Id(request.FundId), ct)).Id;
        item.Amount = request.Amount;
        item.Currency = request.Currency;
        item.Frequency = request.Frequency;
        item.Method = request.Method;
        item.StartsOn = request.StartsOn;
        item.EndsOn = request.EndsOn;
        item.Note = GivingService.Optional(request.Note, "Note", 500);
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, old is null ? "finance.recurring_create" : "finance.recurring_edit", item.Id,
            [Fence(root), old is null ? RecordChange.Create(Key(item.Id), "recurringGift", item) : RecordChange.Replace(Key(item.Id), "recurringGift", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(await ReadAsync(parish, item.Id, ct), Today());
    }

    public async Task<RecurringGiftDto> ActAsync(string parish, string id, RecurringGiftActionDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "recurring-gift-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(await ReadAsync(parish, id, ct), Today());
        var item = (await ReadAsync(parish, id, ct)).Value;
        switch (request.Action)
        {
            case "pause" when item.Status == "Active":
                item.Status = "Paused";
                item.Reason = GivingService.Optional(request.Reason, "Reason", 1000);
                break;
            case "resume" when item.Status == "Paused":
                item.Status = "Active";
                item.Reason = null;
                break;
            case "end" when item.Status is "Active" or "Paused":
                item.Status = "Ended";
                item.Reason = Guard.Text(request.Reason, "Reason", 1000);
                break;
            default:
                throw GivingService.State("This recurring-gift action is not available now.");
        }
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "finance.recurring_" + request.Action, id,
            [Fence(root), RecordChange.Replace(Key(id), "recurringGift", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(await ReadAsync(parish, id, ct), Today());
    }

    public async Task<IReadOnlyList<RecurringGiftDto>> ListAsync(string parish, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var today = Today();
        return (await records.CollectAsync<RecurringGift>(Scope(parish), "recurringGift", ct, 5000)).Where(r => r.Value.ParishId == parish)
            .OrderBy(r => r.Value.Status == "Ended").ThenBy(r => r.Value.StartsOn).ThenBy(r => r.Value.Id, StringComparer.Ordinal)
            .Select(r => Project(r, today)).ToArray();
    }

    // The first scheduled date on or after today, while the gift is active and its schedule has not finished. It is an expectation only.
    internal static DateOnly? NextExpected(RecurringGift x, DateOnly today)
    {
        if (x.Status != "Active")
            return null;
        var step = 0;
        var next = x.StartsOn;
        while (next < today && step < 5000)
        {
            step++;
            next = x.Frequency switch
            {
                "Weekly" => x.StartsOn.AddDays(7 * step),
                "Quarterly" => x.StartsOn.AddMonths(3 * step),
                "Yearly" => x.StartsOn.AddYears(step),
                _ => x.StartsOn.AddMonths(step)
            };
        }
        return next < today || x.EndsOn is { } end && next > end ? null : next;
    }

    private DateOnly Today() => DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

    private async Task<string> HouseholdAsync(string parish, string household, CancellationToken ct)
        => (await records.ReadAsync<Household>(Scope(parish), "household:" + household, ct))?.Value is { } row && row.ParishId == parish ? row.Id : throw Missing();

    private async Task<Versioned<RecurringGift>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<RecurringGift>(Scope(parish), Key(id), ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    private static RecurringGiftDto Project(Versioned<RecurringGift> row, DateOnly today)
    {
        var x = row.Value;
        return new RecurringGiftDto
        {
            Id = x.Id, Version = row.Version, PersonId = x.PersonId, HouseholdId = x.HouseholdId, FundId = x.FundId, Amount = x.Amount, Currency = x.Currency,
            Frequency = x.Frequency, Method = x.Method, StartsOn = x.StartsOn, EndsOn = x.EndsOn, NextExpectedOn = NextExpected(x, today), Note = x.Note,
            Status = x.Status, Reason = x.Reason, CreatedBy = x.CreatedBy, UpdatedBy = x.UpdatedBy
        };
    }
}
