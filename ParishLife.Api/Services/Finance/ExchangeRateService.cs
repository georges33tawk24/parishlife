// Purpose: keeps the exchange rates a parish office records, each with its effective date and source. Rates are typed by an authorized
// person (finance.approve); nothing is fetched from an outside service or invented, and no stored amount is ever converted with a rate.
// Records are append-only: a mistake is corrected by recording the right rate, and the latest recorded rate for a date applies.
// Main functions: RecordAsync, ListAsync and CurrentAsync.

using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Finance;

public class ExchangeRateService(IRecordTransactions records, GivingService giving, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    public async Task<ExchangeRateDto> RecordAsync(string parish, RecordExchangeRateDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "exchange-rate:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await records.ReadAsync<ExchangeRate>(Scope(parish), "exchangeRate:" + prior.Id, ct))!.Value);
        if (!Code(request.BaseCurrency) || !Code(request.QuoteCurrency) || request.BaseCurrency == request.QuoteCurrency)
            throw new DomainException("invalid_input", "Use two different three-letter currency codes.");
        if (request.Rate <= 0 || request.Rate > 1_000_000_000_000m || decimal.Round(request.Rate, 6) != request.Rate)
            throw new DomainException("invalid_input", "Use a positive rate with at most six decimals.");
        // A rate is recorded for a day that has begun somewhere; a future rate cannot have been observed yet.
        if (request.EffectiveOn == default || request.EffectiveOn > DateOnly.FromDateTime(op.At.UtcDateTime.AddHours(14)))
            throw new DomainException("invalid_input", "Record the date the rate applied; it cannot be in the future.");
        var item = new ExchangeRate
        {
            Id = op.Id, ParishId = parish, BaseCurrency = request.BaseCurrency, QuoteCurrency = request.QuoteCurrency, Rate = request.Rate, EffectiveOn = request.EffectiveOn,
            Source = Guard.Text(request.Source, "Source", 300), Note = GivingService.Optional(request.Note, "Note", 1000), RecordedBy = actor.AccountId, RecordedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "finance.exchange_rate_record", item.Id, [Fence(root), RecordChange.Create("exchangeRate:" + item.Id, "exchangeRate", item)],
            new CommandResult { Id = item.Id, Status = "Recorded" }, ct);
        return Project(item);
    }

    // Newest effective date first, then the latest recorded for that date, optionally for one currency pair.
    public async Task<IReadOnlyList<ExchangeRateDto>> ListAsync(string parish, string? baseCurrency, string? quoteCurrency, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        return (await RatesAsync(parish, ct)).Where(r => (baseCurrency is null || r.BaseCurrency == baseCurrency) && (quoteCurrency is null || r.QuoteCurrency == quoteCurrency))
            .Select(Project).ToArray();
    }

    // The rate that applied on a date: the latest recorded rate effective on or before it. None recorded means none is returned.
    public async Task<ExchangeRateDto> CurrentAsync(string parish, string baseCurrency, string quoteCurrency, DateOnly? on, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var day = on ?? DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        return (await RatesAsync(parish, ct)).Where(r => r.BaseCurrency == baseCurrency && r.QuoteCurrency == quoteCurrency && r.EffectiveOn <= day).Select(Project).FirstOrDefault()
            ?? throw new DomainException("resource_not_found", "No exchange rate has been recorded for that pair on or before that date.", FailureKind.NotFound);
    }

    private async Task<IEnumerable<ExchangeRate>> RatesAsync(string parish, CancellationToken ct)
        => (await records.CollectAsync<ExchangeRate>(Scope(parish), "exchangeRate", ct, 5000)).Select(r => r.Value).Where(r => r.ParishId == parish)
            .OrderByDescending(r => r.EffectiveOn).ThenByDescending(r => r.RecordedAt).ThenByDescending(r => r.Id, StringComparer.Ordinal);

    private static bool Code(string? value) => value is { Length: 3 } && value.All(c => c is >= 'A' and <= 'Z');

    private static ExchangeRateDto Project(ExchangeRate x) => new()
    {
        Id = x.Id, BaseCurrency = x.BaseCurrency, QuoteCurrency = x.QuoteCurrency, Rate = x.Rate, EffectiveOn = x.EffectiveOn, Source = x.Source, Note = x.Note,
        RecordedBy = x.RecordedBy, RecordedAt = x.RecordedAt
    };
}
