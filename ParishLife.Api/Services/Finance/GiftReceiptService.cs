// Purpose: issues numbered receipts for posted, attributed gifts and voids them with a reason. Numbers run per parish and per year and restart
// each 1 January in Beirut time (owner decision, 21 November 2026), shown as 2026-0001; receipts issued before keep their plain number. The
// year's counter, the receipt and a one-receipt-per-gift claim change in one conditional transaction (with the parish fence), so a number is taken
// only when its receipt is stored: numbers are unique and none is skipped, and a voided receipt keeps its number. Concurrent issues conflict
// on the counter version and are retried from fresh reads. A receipt records a gift received; it is not a tax document.
// Main functions: IssueAsync, VoidAsync, ListAsync, IssueYear and DisplayNumber.

using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Finance;

public class GiftReceiptService(IRecordTransactions records, GivingService giving, ICurrentActor actor, TimeProvider clock)
{
    private static string CounterKey(int year) => "giftReceiptCounter:" + year.ToString(System.Globalization.CultureInfo.InvariantCulture);
    // All ParishLife parishes are in Lebanon; the API has no per-parish time zone yet.
    private static readonly TimeZoneInfo Beirut = TimeZoneInfo.FindSystemTimeZoneById("Asia/Beirut");
    private const int Attempts = 8;
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    private static string Key(string id) => "giftReceipt:" + id;
    private static string Claim(string contribution) => "giftReceiptFor:" + contribution;
    private static DomainException Missing() => new("resource_not_found", "The requested receipt is unavailable.", FailureKind.NotFound);

    public async Task<GiftReceiptDto> IssueAsync(string parish, IssueReceiptDto request, CancellationToken ct)
    {
        var op = actor.CreateOperation(request.OperationId, request, clock, "gift-receipt:v1:" + parish);
        for (var attempt = 1; ; attempt++)
        {
            // Every attempt re-reads the parish fence, the gift, the claim and the counter, so a retry never reuses a stale number.
            var root = await giving.AuthorizeAsync(parish, Permissions.FinancePost, ct);
            if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
                return await GetAsync(parish, prior.Id, ct);
            var gift = (await records.ReadAsync<Contribution>(Scope(parish), "contribution:" + request.ContributionId, ct))?.Value;
            if (gift is null || gift.ParishId != parish)
                throw new DomainException("resource_not_found", "The requested gift is unavailable.", FailureKind.NotFound);
            if (gift.Status != "Posted" || gift.Amount <= 0)
                throw GivingService.State("Only a posted, unreversed gift receives a receipt.");
            if (gift.Anonymous || gift.PersonId is null && gift.HouseholdId is null)
                throw GivingService.State("An anonymous or unattributed gift has no giver to receive a receipt.");
            if (await records.ReadAsync<CommandResult>(Scope(parish), Claim(gift.Id), ct) is not null)
                throw GivingService.State("This gift already has a receipt; a voided receipt is not reissued.");
            var year = IssueYear(op.At);
            var counter = await records.ReadAsync<GiftReceiptCounter>(Scope(parish), CounterKey(year), ct);
            var number = counter?.Value.Next ?? 1;
            var next = new GiftReceiptCounter { ParishId = parish, Year = year, Next = number + 1 };
            var item = new GiftReceipt
            {
                Id = op.Id, ParishId = parish, Year = year, Number = number, ContributionId = gift.Id, PersonId = gift.PersonId, HouseholdId = gift.HouseholdId, FundId = gift.FundId,
                Amount = gift.Amount, Currency = gift.Currency, ReceivedOn = gift.ReceivedOn, IssuedBy = actor.AccountId, IssuedAt = op.At
            };
            try
            {
                await records.CommitAsync(Scope(parish), op, "finance.receipt_issue", item.Id,
                    [Fence(root),
                     counter is null ? RecordChange.Create(CounterKey(year), "giftReceiptCounter", next) : RecordChange.Replace(CounterKey(year), "giftReceiptCounter", next, counter.Version),
                     RecordChange.Create(Claim(gift.Id), "giftReceiptClaim", new CommandResult { Id = item.Id, Status = "Issued" }),
                     RecordChange.Create(Key(item.Id), "giftReceipt", item)],
                    new CommandResult { Id = item.Id, Status = item.Status }, ct);
                return await GetAsync(parish, item.Id, ct);
            }
            catch (DomainException ex) when (ex.Code == "write_conflict" && attempt < Attempts)
            {
                // Another finance write (often another receipt) committed first; read again and take the next free number.
                await Task.Delay(Random.Shared.Next(5, 25 * attempt), ct);
            }
        }
    }

    public async Task<GiftReceiptDto> VoidAsync(string parish, string id, VoidReceiptDto request, CancellationToken ct)
    {
        var root = await giving.AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "gift-receipt-void:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await GetAsync(parish, id, ct);
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Status != "Issued")
            throw GivingService.State("This receipt was already voided.");
        item.Status = "Voided";
        item.VoidReason = Guard.Text(request.Reason, "Reason", 1000);
        item.VoidedBy = actor.AccountId;
        item.VoidedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "finance.receipt_void", id,
            [Fence(root), RecordChange.Replace(Key(id), "giftReceipt", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return await GetAsync(parish, id, ct);
    }

    public async Task<IReadOnlyList<GiftReceiptDto>> ListAsync(string parish, CancellationToken ct)
    {
        await giving.AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var gifts = (await giving.AllContributionsAsync(parish, ct)).ToDictionary(r => r.Value.Id, r => r.Value.Status, StringComparer.Ordinal);
        return (await records.CollectAsync<GiftReceipt>(Scope(parish), "giftReceipt", ct, 5000)).Where(r => r.Value.ParishId == parish)
            .OrderByDescending(r => r.Value.Year).ThenByDescending(r => r.Value.Number).Select(r => Project(r, gifts.GetValueOrDefault(r.Value.ContributionId) ?? string.Empty)).ToArray();
    }

    private async Task<GiftReceiptDto> GetAsync(string parish, string id, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        var gift = await records.ReadAsync<Contribution>(Scope(parish), "contribution:" + row.Value.ContributionId, ct);
        return Project(row, gift?.Value.Status ?? string.Empty);
    }

    private async Task<Versioned<GiftReceipt>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<GiftReceipt>(Scope(parish), Key(id), ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    internal static int IssueYear(DateTimeOffset at) => TimeZoneInfo.ConvertTime(at, Beirut).Year;

    // 2026-0001 (at least four digits); an older receipt without a year keeps its plain number.
    internal static string DisplayNumber(int year, long number)
        => year > 0 ? year.ToString(System.Globalization.CultureInfo.InvariantCulture) + "-" + number.ToString("D4", System.Globalization.CultureInfo.InvariantCulture)
            : number.ToString(System.Globalization.CultureInfo.InvariantCulture);

    private static GiftReceiptDto Project(Versioned<GiftReceipt> row, string giftStatus)
    {
        var x = row.Value;
        return new GiftReceiptDto
        {
            Id = x.Id, Version = row.Version, Year = x.Year, Number = x.Number, DisplayNumber = DisplayNumber(x.Year, x.Number), ContributionId = x.ContributionId, PersonId = x.PersonId, HouseholdId = x.HouseholdId, FundId = x.FundId,
            Amount = x.Amount, Currency = x.Currency, ReceivedOn = x.ReceivedOn, Status = x.Status, GiftStatus = giftStatus, VoidReason = x.VoidReason,
            VoidedBy = x.VoidedBy, VoidedAt = x.VoidedAt, IssuedBy = x.IssuedBy, IssuedAt = x.IssuedAt
        };
    }
}
