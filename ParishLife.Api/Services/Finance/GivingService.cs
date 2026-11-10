// Purpose: records parish giving: funds, campaigns, counting sessions with independent verification and single posting, posted gifts with
// reversal/reclassification, pledges with receipt allocations, and giving statements. Amounts stay in their actual currency; nothing converts.
// Main functions: CreateFundAsync, FundsAsync, CreateCampaignAsync, CampaignsAsync, OpenSessionAsync, SaveLinesAsync, VerifyAsync, PostAsync,
// SessionAsync, ContributionsAsync, CorrectAsync, CreatePledgeAsync, AllocateAsync, PledgesAsync, StatementAsync and OwnGivingAsync.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Finance;

public class GivingService(IRecordTransactions records, IParishAccess access, MinistryAccess own, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested finance record is unavailable.", FailureKind.NotFound);
    internal static DomainException State(string message) => new("invalid_finance_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    internal async Task<Versioned<Parish>> AuthorizeAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "finance", ct);
        return root;
    }

    // Exact amounts in their own currency: positive, at most two decimal places, three-letter currency code; no rate is applied.
    internal static void Money(decimal amount, string currency)
    {
        if (amount <= 0 || amount > 1_000_000_000_000m || decimal.Round(amount, 2) != amount || currency.Length != 3 || currency.Any(c => c is < 'A' or > 'Z'))
            throw new DomainException("invalid_money", "Use a positive exact amount with at most two decimals and a three-letter currency code.");
    }

    public async Task<FundDto> CreateFundAsync(string parish, SaveFundDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "fund:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync<Fund>(parish, "fund:" + prior.Id, ct)).Value);
        var item = new Fund { Id = op.Id, ParishId = parish, Name = Guard.Text(request.Name, "Name", 200), Purpose = Guard.Text(request.Purpose, "Purpose", 1000),
            Restricted = request.Restricted, CreatedBy = actor.AccountId, CreatedAt = op.At };
        await records.CommitAsync(Scope(parish), op, "finance.fund_create", item.Id, [Fence(root), RecordChange.Create("fund:" + item.Id, "fund", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<IReadOnlyList<FundDto>> FundsAsync(string parish, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        return (await records.CollectAsync<Fund>(Scope(parish), "fund", ct, 500)).Select(r => Project(r.Value)).ToArray();
    }

    public async Task<CampaignDto> CreateCampaignAsync(string parish, SaveCampaignDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "campaign:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await ProjectAsync(parish, (await ReadAsync<Campaign>(parish, "campaign:" + prior.Id, ct)).Value, ct);
        var fund = await ActiveFundAsync(parish, Guard.Id(request.FundId), ct);
        if (request.Targets is null || request.Targets.Count > 10 || request.EndsOn < request.StartsOn)
            throw new DomainException("invalid_input", "Use up to ten currency targets and an end on or after the start.");
        foreach (var (currency, amount) in request.Targets)
            Money(amount, currency);
        var item = new Campaign
        {
            Id = op.Id, ParishId = parish, Name = Guard.Text(request.Name, "Name", 200), Purpose = Guard.Text(request.Purpose, "Purpose", 1000), FundId = fund.Id,
            StartsOn = request.StartsOn, EndsOn = request.EndsOn, Targets = new(request.Targets), CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "finance.campaign_create", item.Id, [Fence(root), RecordChange.Create("campaign:" + item.Id, "campaign", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await ProjectAsync(parish, item, ct);
    }

    public async Task<IReadOnlyList<CampaignDto>> CampaignsAsync(string parish, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var result = new List<CampaignDto>();
        foreach (var row in await records.CollectAsync<Campaign>(Scope(parish), "campaign", ct, 500))
            result.Add(await ProjectAsync(parish, row.Value, ct));
        return result;
    }

    public async Task<CountSessionDto> OpenSessionAsync(string parish, OpenSessionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "count-session:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync<CountSession>(parish, "countSession:" + prior.Id, ct)).Value);
        var item = new CountSession
        {
            Id = op.Id, ParishId = parish, Reference = "CS-" + request.CollectedOn.ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture) + "-" + op.Id[..6].ToUpperInvariant(),
            Source = Guard.Text(request.Source, "Source", 200), CollectedOn = request.CollectedOn, EditorAccountIds = [actor.AccountId], CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "finance.session_open", item.Id, [Fence(root), RecordChange.Create("countSession:" + item.Id, "countSession", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<CountSessionDto> SaveLinesAsync(string parish, string id, SaveLinesDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "count-lines:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync<CountSession>(parish, "countSession:" + id, ct)).Value);
        var item = (await ReadAsync<CountSession>(parish, "countSession:" + id, ct)).Value;
        if (item.Status is not ("Open" or "Variance"))
            throw State("Only an open session (or one with a recorded variance) can be recounted.");
        // ponytail: 90 lines per session keeps posting inside one atomic Cosmos batch; split large collections into more sessions.
        if (request.Lines is null || request.Lines.Length > 90 || request.Lines.Select(l => l.Key).Distinct(StringComparer.Ordinal).Count() != request.Lines.Length)
            throw new DomainException("invalid_input", "Use up to 90 lines with distinct keys per session.");
        var lines = new List<GiftLine>();
        foreach (var line in request.Lines)
            lines.Add(await LineAsync(parish, line, ct));
        item.Lines = [.. lines];
        item.Revision++;
        item.Status = "Open";
        item.VerifiedBy = null;
        item.VerifiedRevision = null;
        if (!item.EditorAccountIds.Contains(actor.AccountId))
            item.EditorAccountIds = [.. item.EditorAccountIds, actor.AccountId];
        await records.CommitAsync(Scope(parish), op, "finance.session_lines", id,
            [Fence(root), RecordChange.Replace("countSession:" + id, "countSession", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<CountSessionDto> VerifyAsync(string parish, string id, VerifySessionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "count-verify:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync<CountSession>(parish, "countSession:" + id, ct)).Value);
        var item = (await ReadAsync<CountSession>(parish, "countSession:" + id, ct)).Value;
        // Verification is a different person's actual count of the exact revision they reviewed.
        if (item.Status != "Open" || item.Lines.Length == 0 || item.EditorAccountIds.Contains(actor.AccountId))
            throw State("A person who did not count or edit this open session verifies it.");
        if (request.Revision != item.Revision)
            throw new DomainException("write_conflict", "The session changed since you started verifying; review the current revision.", FailureKind.Conflict);
        var expected = Totals(item.Lines);
        var observed = (request.Observed ?? []).GroupBy(o => (o.Currency, o.Method)).Select(g => new CurrencyTotal { Currency = g.Key.Currency, Method = g.Key.Method, Amount = g.Sum(o => o.Amount) })
            .OrderBy(t => t.Currency, StringComparer.Ordinal).ThenBy(t => t.Method, StringComparer.Ordinal).ToArray();
        if (expected.Length == observed.Length && expected.Zip(observed).All(p => p.First.Currency == p.Second.Currency && p.First.Method == p.Second.Method && p.First.Amount == p.Second.Amount))
        {
            item.Status = "Verified";
            item.VerifiedBy = actor.AccountId;
            item.VerifiedRevision = item.Revision;
            item.VarianceObserved = [];
            item.VarianceNote = null;
        }
        else
        {
            // Disagreement keeps both observations and leaves the session for a recount; no total is adjusted to agree.
            item.Status = "Variance";
            item.VarianceObserved = observed;
            item.VarianceNote = string.IsNullOrWhiteSpace(request.Note) ? null : Guard.Text(request.Note, "Note", 2000);
        }
        await records.CommitAsync(Scope(parish), op, "finance.session_verify", id,
            [Fence(root), RecordChange.Replace("countSession:" + id, "countSession", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<CountSessionDto> PostAsync(string parish, string id, PostSessionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinancePost, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "count-post:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync<CountSession>(parish, "countSession:" + id, ct)).Value);
        var item = (await ReadAsync<CountSession>(parish, "countSession:" + id, ct)).Value;
        if (item.Status != "Verified" || item.VerifiedRevision != item.Revision)
            throw State("Only a session independently verified at its current revision is posted.");
        item.Status = "Posted";
        item.PostedBy = actor.AccountId;
        item.PostedAt = op.At;
        var changes = new List<RecordChange> { Fence(root), RecordChange.Replace("countSession:" + id, "countSession", item, Versions.Require(request.Version)) };
        // Deterministic contribution ids make a second posting of the same line impossible, even across retries.
        changes.AddRange(item.Lines.Select(line => RecordChange.Create("contribution:" + ContributionId(id, line.Key), "contribution", new Contribution
        {
            Id = ContributionId(id, line.Key), ParishId = parish, SessionId = id, Amount = line.Amount, Currency = line.Currency, Method = line.Method, FundId = line.FundId,
            CampaignId = line.CampaignId, PersonId = line.PersonId, HouseholdId = line.HouseholdId, Anonymous = line.Anonymous, ReceivedOn = item.CollectedOn,
            PostedBy = actor.AccountId, PostedAt = op.At
        })));
        await records.CommitAsync(Scope(parish), op, "finance.session_post", id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<Versioned<CountSessionDto>> SessionAsync(string parish, string id, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var row = await ReadAsync<CountSession>(parish, "countSession:" + id, ct);
        return new Versioned<CountSessionDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<IReadOnlyList<Versioned<ContributionDto>>> ContributionsAsync(string parish, string? fund, string? campaign, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        return (await AllContributionsAsync(parish, ct)).Where(r => (fund is null || r.Value.FundId == fund) && (campaign is null || r.Value.CampaignId == campaign))
            .OrderBy(r => r.Value.ReceivedOn).ThenBy(r => r.Value.Id, StringComparer.Ordinal)
            .Select(r => new Versioned<ContributionDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    public async Task<ContributionDto> CorrectAsync(string parish, string id, CorrectContributionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinanceApprove, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "contribution-correct:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync<Contribution>(parish, "contribution:" + prior.Id, ct)).Value);
        var original = (await ReadAsync<Contribution>(parish, "contribution:" + id, ct)).Value;
        if (original.Status != "Posted")
            throw State("Only a posted, unreversed gift can be corrected.");
        var reason = Guard.Text(request.Reason, "Reason", 2000);
        original.Status = "Reversed";
        // The original stays; a linked reversal cancels its effect, and a reclassification posts the corrected allocation.
        var reversal = new Contribution
        {
            Id = op.Id + "r", ParishId = parish, SessionId = original.SessionId, Amount = -original.Amount, Currency = original.Currency, Method = original.Method,
            FundId = original.FundId, CampaignId = original.CampaignId, PersonId = original.PersonId, HouseholdId = original.HouseholdId, Anonymous = original.Anonymous,
            ReceivedOn = original.ReceivedOn, Status = "Reversal", ReversalOf = original.Id, Reason = reason, PostedBy = actor.AccountId, PostedAt = op.At
        };
        var changes = new List<RecordChange> { Fence(root), RecordChange.Replace("contribution:" + id, "contribution", original, Versions.Require(request.Version)),
            RecordChange.Create("contribution:" + reversal.Id, "contribution", reversal) };
        var result = reversal;
        if (request.Action == "reclassify")
        {
            var fund = request.FundId is { } f ? (await ActiveFundAsync(parish, Guard.Id(f), ct)).Id : original.FundId;
            var corrected = new Contribution
            {
                Id = op.Id + "c", ParishId = parish, SessionId = original.SessionId, Amount = original.Amount, Currency = original.Currency, Method = original.Method,
                FundId = fund, CampaignId = original.CampaignId, PersonId = request.PersonId is { } p ? await PersonAsync(parish, Guard.Id(p), ct) : original.PersonId,
                HouseholdId = request.HouseholdId is { } h ? Guard.Id(h) : original.HouseholdId, Anonymous = request.Anonymous ?? original.Anonymous,
                ReceivedOn = original.ReceivedOn, ReclassifiedFrom = original.Id, Reason = reason, PostedBy = actor.AccountId, PostedAt = op.At
            };
            changes.Add(RecordChange.Create("contribution:" + corrected.Id, "contribution", corrected));
            result = corrected;
        }
        else if (request.Action != "reverse")
            throw new DomainException("invalid_input", "Use reverse or reclassify.");
        await records.CommitAsync(Scope(parish), op, "finance.contribution_" + request.Action, id, changes, new CommandResult { Id = result.Id, Status = result.Status }, ct);
        return Project(result);
    }

    public async Task<PledgeDto> CreatePledgeAsync(string parish, SavePledgeDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "pledge:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await ProjectAsync(parish, (await ReadAsync<Pledge>(parish, "pledge:" + prior.Id, ct)).Value, ct);
        Money(request.Amount, request.Currency);
        if (request.PersonId is null && request.HouseholdId is null || request.EndsOn < request.StartsOn)
            throw new DomainException("invalid_input", "A pledge belongs to a person or household and ends on or after it starts.");
        var item = new Pledge
        {
            Id = op.Id, ParishId = parish, PersonId = request.PersonId is { } p ? await PersonAsync(parish, Guard.Id(p), ct) : null,
            HouseholdId = request.HouseholdId is { } h ? Guard.Id(h) : null, FundId = (await ActiveFundAsync(parish, Guard.Id(request.FundId), ct)).Id,
            CampaignId = request.CampaignId is { } c ? (await ReadAsync<Campaign>(parish, "campaign:" + Guard.Id(c), ct)).Value.Id : null,
            Amount = request.Amount, Currency = request.Currency, Schedule = string.IsNullOrWhiteSpace(request.Schedule) ? null : Guard.Text(request.Schedule, "Schedule", 300),
            StartsOn = request.StartsOn, EndsOn = request.EndsOn, CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "finance.pledge_create", item.Id, [Fence(root), RecordChange.Create("pledge:" + item.Id, "pledge", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await ProjectAsync(parish, item, ct);
    }

    public async Task<PledgeDto> AllocateAsync(string parish, string pledge, AllocatePledgeDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FinanceEnter, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "pledge-allocate:v1:" + pledge);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await ProjectAsync(parish, (await ReadAsync<Pledge>(parish, "pledge:" + pledge, ct)).Value, ct);
        var pledgeRow = await ReadAsync<Pledge>(parish, "pledge:" + pledge, ct);
        var gift = await ReadAsync<Contribution>(parish, "contribution:" + Guard.Id(request.ContributionId), ct);
        if (pledgeRow.Value.Status != "Active" || gift.Value.Status != "Posted" || gift.Value.Currency != pledgeRow.Value.Currency)
            throw State("Allocate a posted gift to an active pledge in the same currency.");
        Money(request.Amount, gift.Value.Currency);
        var used = (await AllocationsAsync(parish, ct)).Where(a => a.ContributionId == gift.Value.Id).Sum(a => a.Amount);
        if (used + request.Amount > gift.Value.Amount)
            throw State("The allocation exceeds the gift's unallocated amount.");
        var allocated = (await AllocationsAsync(parish, ct)).Where(a => a.PledgeId == pledge).Sum(a => a.Amount) + request.Amount;
        if (allocated >= pledgeRow.Value.Amount)
            pledgeRow.Value.Status = "Fulfilled";
        // The gift is fenced so two concurrent allocations cannot both spend the same unallocated amount.
        await records.CommitAsync(Scope(parish), op, "finance.pledge_allocate", pledge,
            [Fence(root), RecordChange.Replace("contribution:" + gift.Value.Id, "contribution", gift.Value, gift.Version),
             RecordChange.Replace("pledge:" + pledge, "pledge", pledgeRow.Value, pledgeRow.Version),
             RecordChange.Create("pledgeAllocation:" + op.Id, "pledgeAllocation", new PledgeAllocation
             {
                 Id = op.Id, PledgeId = pledge, ContributionId = gift.Value.Id, Amount = request.Amount, Currency = gift.Value.Currency, AllocatedBy = actor.AccountId, AllocatedAt = op.At
             })], new CommandResult { Id = pledge, Status = pledgeRow.Value.Status }, ct);
        return await ProjectAsync(parish, pledgeRow.Value, ct);
    }

    public async Task<IReadOnlyList<PledgeDto>> PledgesAsync(string parish, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        var result = new List<PledgeDto>();
        foreach (var row in await records.CollectAsync<Pledge>(Scope(parish), "pledge", ct, 2000))
            result.Add(await ProjectAsync(parish, row.Value, ct));
        return result;
    }

    public async Task<GivingStatementDto> StatementAsync(string parish, string? person, string? household, int year, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.FinanceRead, ct);
        if (person is null == household is null)
            throw new DomainException("invalid_input", "Choose exactly one person or household.");
        return await StatementForAsync(parish, person, household, year, ct);
    }

    // Members see only gifts attributed to their own Person and not given anonymously; household giving needs explicit finance authority.
    public async Task<GivingStatementDto> OwnGivingAsync(string parish, int year, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        return await StatementForAsync(parish, link.Value.PersonId, null, year, ct);
    }

    private async Task<GivingStatementDto> StatementForAsync(string parish, string? person, string? household, int year, CancellationToken ct)
    {
        var rows = (await AllContributionsAsync(parish, ct)).Select(r => r.Value)
            .Where(c => !c.Anonymous && c.ReceivedOn.Year == year && (person is not null && c.PersonId == person || household is not null && c.HouseholdId == household))
            .OrderBy(c => c.ReceivedOn).ThenBy(c => c.Id, StringComparer.Ordinal).ToArray();
        return new GivingStatementDto
        {
            Year = year, PersonId = person, HouseholdId = household, Contributions = rows.Select(Project).ToArray(),
            Totals = rows.GroupBy(c => c.Currency).ToDictionary(g => g.Key, g => g.Sum(c => c.Amount), StringComparer.Ordinal)
        };
    }

    private async Task<GiftLine> LineAsync(string parish, GiftLineDto line, CancellationToken ct)
    {
        Money(line.Amount, line.Currency);
        if (line.Method is not ("Cash" or "Bank" or "Cheque" or "Card" or "Other"))
            throw new DomainException("invalid_input", "Use Cash, Bank, Cheque, Card or Other.");
        var result = new GiftLine
        {
            Key = Guard.Text(line.Key, "Line key", 40), Amount = line.Amount, Currency = line.Currency, Method = line.Method,
            FundId = (await ActiveFundAsync(parish, Guard.Id(line.FundId), ct)).Id,
            CampaignId = line.CampaignId is { } c ? (await ReadAsync<Campaign>(parish, "campaign:" + Guard.Id(c), ct)).Value.Id : null,
            PersonId = line.PersonId is { } p ? await PersonAsync(parish, Guard.Id(p), ct) : null, Anonymous = line.Anonymous,
            Reference = string.IsNullOrWhiteSpace(line.Reference) ? null : Guard.Text(line.Reference, "Reference", 200)
        };
        if (!string.IsNullOrWhiteSpace(line.EnvelopeId))
        {
            // Envelope numbers resolve only against actual household assignments; an unknown number stays unattributed for review.
            result.EnvelopeId = Guard.Text(line.EnvelopeId, "Envelope", 40);
            var claim = await records.ReadAsync<CommandResult>(Scope(parish), "householdEnvelope:" + result.EnvelopeId.ToUpperInvariant(), ct);
            result.HouseholdId = claim?.Value.Id;
            result.Unattributed = claim is null;
        }
        if (result.Anonymous)
        {
            result.PersonId = null;
            result.HouseholdId = null;
            result.EnvelopeId = null;
            result.Unattributed = false;
        }
        return result;
    }

    internal async Task<Fund> ActiveFundAsync(string parish, string fund, CancellationToken ct)
    {
        var row = (await ReadAsync<Fund>(parish, "fund:" + fund, ct)).Value;
        if (row.Status != "Active")
            throw State("Use an active fund.");
        return row;
    }

    private async Task<string> PersonAsync(string parish, string person, CancellationToken ct)
        => (await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct))?.Value is { } row && row.ParishId == parish ? row.Id : throw Missing();

    // ponytail: giving reads scan up to 5000 contribution rows per parish; add per-fund/period summaries if a parish outgrows that.
    internal async Task<IReadOnlyList<Versioned<Contribution>>> AllContributionsAsync(string parish, CancellationToken ct)
        => await records.CollectAsync<Contribution>(Scope(parish), "contribution", ct, 5000);

    private async Task<List<PledgeAllocation>> AllocationsAsync(string parish, CancellationToken ct)
        => (await records.CollectAsync<PledgeAllocation>(Scope(parish), "pledgeAllocation", ct, 5000)).Select(r => r.Value).ToList();

    private async Task<Versioned<T>> ReadAsync<T>(string parish, string key, CancellationToken ct)
        => await records.ReadAsync<T>(Scope(parish), key, ct) ?? throw Missing();

    private static string ContributionId(string session, string line)
        => new Guid(SHA256.HashData(Encoding.UTF8.GetBytes(session + ":" + line)).AsSpan(0, 16)).ToString("N");

    private static CurrencyTotal[] Totals(IEnumerable<GiftLine> lines) => lines.GroupBy(l => (l.Currency, l.Method))
        .Select(g => new CurrencyTotal { Currency = g.Key.Currency, Method = g.Key.Method, Amount = g.Sum(l => l.Amount) })
        .OrderBy(t => t.Currency, StringComparer.Ordinal).ThenBy(t => t.Method, StringComparer.Ordinal).ToArray();

    private static FundDto Project(Fund x) => new() { Id = x.Id, Name = x.Name, Purpose = x.Purpose, Restricted = x.Restricted, Status = x.Status };

    private async Task<CampaignDto> ProjectAsync(string parish, Campaign x, CancellationToken ct)
    {
        var gifts = (await AllContributionsAsync(parish, ct)).Select(r => r.Value).Where(c => c.CampaignId == x.Id);
        var pledges = (await records.CollectAsync<Pledge>(Scope(parish), "pledge", ct, 2000)).Select(r => r.Value).Where(p => p.CampaignId == x.Id && p.Status != "Cancelled");
        return new CampaignDto
        {
            Id = x.Id, Name = x.Name, Purpose = x.Purpose, FundId = x.FundId, StartsOn = x.StartsOn, EndsOn = x.EndsOn, Targets = new(x.Targets), Status = x.Status,
            Received = gifts.GroupBy(c => c.Currency).ToDictionary(g => g.Key, g => g.Sum(c => c.Amount), StringComparer.Ordinal),
            Pledged = pledges.GroupBy(p => p.Currency).ToDictionary(g => g.Key, g => g.Sum(p => p.Amount), StringComparer.Ordinal)
        };
    }

    private async Task<PledgeDto> ProjectAsync(string parish, Pledge x, CancellationToken ct) => new()
    {
        Id = x.Id, PersonId = x.PersonId, HouseholdId = x.HouseholdId, FundId = x.FundId, CampaignId = x.CampaignId, Amount = x.Amount, Currency = x.Currency,
        Allocated = (await AllocationsAsync(parish, ct)).Where(a => a.PledgeId == x.Id).Sum(a => a.Amount), Schedule = x.Schedule, StartsOn = x.StartsOn,
        EndsOn = x.EndsOn, Status = x.Status
    };

    private static CountSessionDto Project(CountSession x) => new()
    {
        Id = x.Id, Reference = x.Reference, Source = x.Source, CollectedOn = x.CollectedOn, Status = x.Status, Revision = x.Revision,
        Lines = x.Lines.Select(l => new GiftLineDto
        {
            Key = l.Key, Amount = l.Amount, Currency = l.Currency, Method = l.Method, FundId = Guid.Parse(l.FundId), CampaignId = l.CampaignId is null ? null : Guid.Parse(l.CampaignId),
            PersonId = l.PersonId is null ? null : Guid.Parse(l.PersonId), EnvelopeId = l.EnvelopeId, Anonymous = l.Anonymous, Reference = l.Reference,
            HouseholdId = l.HouseholdId, Unattributed = l.Unattributed
        }).ToArray(),
        Totals = Totals(x.Lines).Select(t => new CurrencyTotalDto { Currency = t.Currency, Method = t.Method, Amount = t.Amount }).ToArray(),
        VerifiedBy = x.VerifiedBy, VerifiedRevision = x.VerifiedRevision, VarianceNote = x.VarianceNote, PostedBy = x.PostedBy, PostedAt = x.PostedAt,
        VarianceObserved = x.VarianceObserved.Select(t => new CurrencyTotalDto { Currency = t.Currency, Method = t.Method, Amount = t.Amount }).ToArray()
    };

    internal static ContributionDto Project(Contribution x) => new()
    {
        Id = x.Id, SessionId = x.SessionId, Amount = x.Amount, Currency = x.Currency, Method = x.Method, FundId = x.FundId, CampaignId = x.CampaignId,
        PersonId = x.Anonymous ? null : x.PersonId, HouseholdId = x.Anonymous ? null : x.HouseholdId, Anonymous = x.Anonymous, ReceivedOn = x.ReceivedOn,
        Status = x.Status, ReversalOf = x.ReversalOf, ReclassifiedFrom = x.ReclassifiedFrom, Reason = x.Reason
    };
}
