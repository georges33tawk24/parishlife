// Purpose: verifies parish giving and expenses (S24–S25) through real local services and storage.
// Main tests: counting sessions with envelope resolution, independent verification, recorded variance, single posting and per-currency
// balances; reversal/reclassification, pledge allocation limits, campaign totals and statements; expenses with separated duties.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Finance;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public partial class FinanceTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Treasurer, string Counter, string Verifier, string Poster)
    {
        public GivingService Giving => F.Services.GetRequiredService<GivingService>();
        public ExpenseService Expenses => F.Services.GetRequiredService<ExpenseService>();
        public string Parish => Staff.Parish;
        public void Priest() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Sessions_are_independently_verified_posted_once_and_balanced_per_currency()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        var household = await HouseholdAsync(x, "E-7");
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Parish operations" }, default);

        f.As(x.Counter);
        var session = await x.Giving.OpenSessionAsync(x.Parish, new OpenSessionDto { OperationId = Guid.NewGuid(), Source = "Sunday collection", CollectedOn = new DateOnly(2026, 11, 1) }, default);
        var saved = await SaveLinesAsync(x, session.Id,
            Line("a", 100m, "USD", "Cash", fund.Id, person: person),
            Line("b", 500000m, "LBP", "Cash", fund.Id, envelope: "e-7"),
            Line("c", 50m, "USD", "Bank", fund.Id, person: person, anonymous: true),
            Line("d", 20m, "USD", "Cash", fund.Id, envelope: "E-404"));
        Assert.Equal(household, saved.Lines.Single(l => l.Key == "b").HouseholdId);
        Assert.Null(saved.Lines.Single(l => l.Key == "c").PersonId);
        Assert.True(saved.Lines.Single(l => l.Key == "d").Unattributed);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => VerifyAsync(x, session.Id, 1, Totals(("USD", "Cash", 120m), ("LBP", "Cash", 500000m), ("USD", "Bank", 50m))))).Code);

        f.As(x.Verifier);
        var variance = await VerifyAsync(x, session.Id, 1, Totals(("USD", "Cash", 110m), ("LBP", "Cash", 500000m), ("USD", "Bank", 50m)));
        Assert.Equal("Variance", variance.Status);
        Assert.Equal(110m, variance.VarianceObserved.Single(t => t.Currency == "USD" && t.Method == "Cash").Amount);
        Assert.Equal(120m, variance.Totals.Single(t => t.Currency == "USD" && t.Method == "Cash").Amount);
        f.As(x.Poster);
        await Assert.ThrowsAsync<DomainException>(() => PostAsync(x, session.Id));

        f.As(x.Counter);
        await SaveLinesAsync(x, session.Id,
            Line("a", 90m, "USD", "Cash", fund.Id, person: person),
            Line("b", 500000m, "LBP", "Cash", fund.Id, envelope: "E-7"),
            Line("c", 50m, "USD", "Bank", fund.Id, anonymous: true),
            Line("d", 20m, "USD", "Cash", fund.Id, envelope: "E-404"));
        f.As(x.Verifier);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => VerifyAsync(x, session.Id, 1, Totals(("USD", "Cash", 110m))))).Code);
        Assert.Equal("Verified", (await VerifyAsync(x, session.Id, 2, Totals(("USD", "Cash", 110m), ("LBP", "Cash", 500000m), ("USD", "Bank", 50m)))).Status);

        f.As(x.Poster);
        Assert.Equal("Posted", (await PostAsync(x, session.Id)).Status);
        await Assert.ThrowsAsync<DomainException>(() => PostAsync(x, session.Id));
        f.As(x.Treasurer);
        Assert.Equal(4, (await x.Giving.ContributionsAsync(x.Parish, null, null, default)).Count);
        var balances = await x.Expenses.BalancesAsync(x.Parish, default);
        Assert.Equal(160m, balances.Single(b => b.Currency == "USD").Balance);
        Assert.Equal(500000m, balances.Single(b => b.Currency == "LBP").Balance);
    }

    [Fact]
    public async Task Corrections_pledges_campaigns_and_statements_use_actual_posted_gifts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        f.As(x.Treasurer);
        var general = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        var roof = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "Roof", Purpose = "Roof repair", Restricted = true }, default);
        var campaign = await x.Giving.CreateCampaignAsync(x.Parish, new SaveCampaignDto
        {
            OperationId = Guid.NewGuid(), Name = "Roof appeal", Purpose = "Repair the roof", FundId = Guid.Parse(roof.Id), StartsOn = new DateOnly(2026, 10, 1),
            Targets = new() { ["USD"] = 10000m }
        }, default);
        var posted = await PostedAsync(x,
            Line("a", 200m, "USD", "Cash", roof.Id, person: member.Person, campaign: campaign.Id),
            Line("b", 75m, "USD", "Cash", general.Id, person: member.Person),
            Line("c", 40m, "USD", "Cash", general.Id, person: member.Person, anonymous: true),
            Line("d", 300000m, "LBP", "Cash", general.Id, person: member.Person));

        f.As(x.Treasurer);
        var gifts = await x.Giving.ContributionsAsync(x.Parish, null, null, default);
        var misfiled = gifts.Single(g => g.Value.Amount == 75m);
        var moved = await x.Giving.CorrectAsync(x.Parish, misfiled.Value.Id, new CorrectContributionDto
        {
            OperationId = Guid.NewGuid(), Version = misfiled.Version, Action = "reclassify", Reason = "Donor asked for the roof fund", FundId = Guid.Parse(roof.Id)
        }, default);
        Assert.Equal((roof.Id, misfiled.Value.Id), (moved.FundId, moved.ReclassifiedFrom));
        var lbp = gifts.Single(g => g.Value.Currency == "LBP");
        Assert.Equal(-300000m, (await x.Giving.CorrectAsync(x.Parish, lbp.Value.Id, new CorrectContributionDto
        {
            OperationId = Guid.NewGuid(), Version = lbp.Version, Action = "reverse", Reason = "Counterfeit note found"
        }, default)).Amount);
        var balances = await x.Expenses.BalancesAsync(x.Parish, default);
        Assert.Equal(275m, balances.Single(b => b.FundId == roof.Id && b.Currency == "USD").Balance);
        Assert.Equal(0m, balances.Single(b => b.FundId == general.Id && b.Currency == "LBP").Balance);

        f.As(x.Counter);
        var pledge = await x.Giving.CreatePledgeAsync(x.Parish, new SavePledgeDto
        {
            OperationId = Guid.NewGuid(), PersonId = Guid.Parse(member.Person), FundId = Guid.Parse(roof.Id), CampaignId = Guid.Parse(campaign.Id),
            Amount = 300m, Currency = "USD", Schedule = "Monthly", StartsOn = new DateOnly(2026, 10, 1)
        }, default);
        var roofGift = posted.Single(g => g.Amount == 200m);
        Assert.Equal(150m, (await AllocateAsync(x, pledge.Id, roofGift.Id, 150m)).Allocated);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => AllocateAsync(x, pledge.Id, roofGift.Id, 60m))).Code);
        f.As(x.Treasurer);
        var appeal = Assert.Single(await x.Giving.CampaignsAsync(x.Parish, default));
        Assert.Equal((200m, 300m), (appeal.Received["USD"], appeal.Pledged["USD"]));

        var statement = await x.Giving.StatementAsync(x.Parish, member.Person, null, 2026, default);
        Assert.DoesNotContain(statement.Contributions, c => c.Amount == 40m);
        Assert.Equal(275m, statement.Totals["USD"]);
        Assert.Equal(0m, statement.Totals["LBP"]);
        Assert.Contains("not a tax receipt", statement.Notice);
        f.As(member.Account, mfa: false);
        Assert.Equal(275m, (await x.Giving.OwnGivingAsync(x.Parish, 2026, default)).Totals["USD"]);
        await Assert.ThrowsAsync<DomainException>(() => x.Giving.ContributionsAsync(x.Parish, null, null, default));
    }

    [Fact]
    public async Task Expenses_need_independent_approval_an_explicit_missing_receipt_exception_and_an_actual_payment()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        await PostedAsync(x, Line("a", 500m, "USD", "Cash", fund.Id));

        f.As(x.Counter);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Expenses.SaveAsync(x.Parish, null, Expense(fund.Id, null, null), default))).Code);
        var expense = await x.Expenses.SaveAsync(x.Parish, null, Expense(fund.Id, null, "Vendor issued no receipt for the candles"), default);
        await ExpenseActAsync(x, expense.Id, "submit");
        f.As(x.Treasurer);
        var approved = await ExpenseActAsync(x, expense.Id, "approve");
        Assert.True(approved.MissingEvidenceApproved);
        Assert.Equal(x.Treasurer, approved.ApprovedBy);
        f.As(x.Poster);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ExpenseActAsync(x, expense.Id, "record-payment", paidOn: new DateOnly(2027, 1, 1)))).Code);
        Assert.Equal("Paid", (await ExpenseActAsync(x, expense.Id, "record-payment", paidOn: new DateOnly(2026, 11, 2))).Status);
        Assert.Equal(380m, Assert.Single(await x.Expenses.BalancesAsync(x.Parish, default)).Balance);

        var dual = await GrantAsync(x.Staff, [Permissions.FinanceEnter, Permissions.FinanceApprove, Permissions.FinanceRead]);
        f.As(dual);
        var own = await x.Expenses.SaveAsync(x.Parish, null, Expense(fund.Id, "Invoice 77", null), default);
        await ExpenseActAsync(x, own.Id, "submit");
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => ExpenseActAsync(x, own.Id, "approve"))).Code);
    }

    [Fact]
    public async Task Bank_lines_import_once_match_exactly_and_months_close_only_by_an_independent_reviewer()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        var gift = Assert.Single(await PostedAsync(x, Line("a", 500m, "USD", "Cheque", fund.Id)));
        f.As(x.Counter);
        var expense = await x.Expenses.SaveAsync(x.Parish, null, Expense(fund.Id, "Invoice 12", null), default);
        await ExpenseActAsync(x, expense.Id, "submit");
        f.As(x.Treasurer);
        await ExpenseActAsync(x, expense.Id, "approve");
        f.As(x.Poster);
        await ExpenseActAsync(x, expense.Id, "record-payment", paidOn: new DateOnly(2026, 11, 2));

        var bank = f.Services.GetRequiredService<BankReconciliationService>();
        const string csv = "Date,Reference,Amount,Currency\n2026-11-03,DEP-1,500.00,USD\n2026-11-04,CHQ-9,-120.00,USD\n2026-11-05,FEE,-2.50,USD\n2026-11-06,UNKNOWN,40.00,USD\n";
        f.As(x.Counter);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => bank.ImportAsync(x.Parish,
            new ImportBankLinesDto { OperationId = Guid.NewGuid(), BankAccount = "Main", Csv = csv + "03/11/2026,X,1.00,USD\n" }, default))).Code);
        Assert.Equal(4, (await bank.ImportAsync(x.Parish, new ImportBankLinesDto { OperationId = Guid.NewGuid(), BankAccount = "Main", Csv = csv }, default)).Imported);
        var repeat = await bank.ImportAsync(x.Parish, new ImportBankLinesDto { OperationId = Guid.NewGuid(), BankAccount = "Main", Csv = csv }, default);
        Assert.Equal((0, 4), (repeat.Imported, repeat.Duplicates));

        f.As(x.Poster);
        var lines = (await bank.LinesAsync(x.Parish, "Main", null, default)).ToDictionary(l => l.Reference);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => MatchAsync(bank, x, lines["DEP-1"], ("Contribution", gift.Id, 400m)))).Code);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => MatchAsync(bank, x, lines["DEP-1"], ("Expense", expense.Id, 500m)))).Code);
        Assert.Equal("Matched", (await MatchAsync(bank, x, lines["DEP-1"], ("Contribution", gift.Id, 500m))).Status);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => MatchAsync(bank, x, lines["UNKNOWN"], ("Contribution", gift.Id, 40m)))).Code);
        await MatchAsync(bank, x, lines["CHQ-9"], ("Expense", expense.Id, -120m));
        await bank.ActAsync(x.Parish, lines["UNKNOWN"].Id, new BankLineActionDto
        {
            OperationId = Guid.NewGuid(), Version = lines["UNKNOWN"].Version, Action = "outstanding", Reason = "Treasurer to identify the depositor"
        }, default);
        var close = new ReconcileBankDto { OperationId = Guid.NewGuid(), BankAccount = "Main", Period = "2026-11" };
        await Assert.ThrowsAsync<DomainException>(() => bank.ReconcileAsync(x.Parish, close, default));
        var dual = await GrantAsync(x.Staff, [Permissions.FinancePost, Permissions.FinanceApprove, Permissions.FinanceRead]);
        f.As(dual);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => bank.ReconcileAsync(x.Parish, close, default))).Code);
        await MatchAsync(bank, x, lines["FEE"], ("Fee", null, -2.50m));
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => bank.ReconcileAsync(x.Parish, close, default))).Code);

        f.As(x.Treasurer);
        var closed = await bank.ReconcileAsync(x.Parish, close, default);
        Assert.Equal(("Closed", 417.50m, 1), (closed.Status, closed.Totals["USD"], closed.OutstandingLineIds.Length));
        var current = (await bank.LinesAsync(x.Parish, "Main", "Matched", default)).Single(l => l.Reference == "FEE");
        var unmatch = new BankLineActionDto { OperationId = Guid.NewGuid(), Version = current.Version, Action = "unmatch", Reason = "Fee belongs to October" };
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => bank.ActAsync(x.Parish, current.Id, unmatch, default))).Code);
        Assert.Equal("Reopened", (await bank.ReopenAsync(x.Parish, new ReconcileBankDto { OperationId = Guid.NewGuid(), BankAccount = "Main", Period = "2026-11", Reason = "Fee correction" }, default)).Status);
        unmatch.OperationId = Guid.NewGuid();
        Assert.Equal("Unmatched", (await bank.ActAsync(x.Parish, current.Id, unmatch, default)).Status);
    }

    [Fact]
    public async Task Office_ledger_opens_once_closes_months_independently_and_corrects_closed_months_by_reversal()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var ledger = f.Services.GetRequiredService<OfficeLedgerService>();
        f.As(x.Counter);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => ledger.SaveAsync(x.Parish, null, Allowance(100m, "USD", new DateOnly(2026, 10, 5)), default))).Code);
        f.As(x.Treasurer);
        var opening = new OfficeOpeningDto { OperationId = Guid.NewGuid(), Currency = "USD", Amount = 50m, EffectiveOn = new DateOnly(2026, 10, 1), Provenance = "Isolated cash count" };
        await ledger.OpenAsync(x.Parish, opening, default);
        await ledger.OpenAsync(x.Parish, new OfficeOpeningDto { OperationId = Guid.NewGuid(), Currency = "LBP", Amount = 0m, EffectiveOn = new DateOnly(2026, 10, 1), Provenance = "New box" }, default);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => ledger.OpenAsync(x.Parish,
            new OfficeOpeningDto { OperationId = Guid.NewGuid(), Currency = "USD", Amount = 70m, EffectiveOn = new DateOnly(2026, 11, 1), Provenance = "Second" }, default))).Code);

        f.As(x.Counter);
        await ledger.SaveAsync(x.Parish, null, Allowance(100m, "USD", new DateOnly(2026, 10, 5)), default);
        var purchase = await ledger.SaveAsync(x.Parish, null, new SaveOfficeEntryDto
        {
            OperationId = Guid.NewGuid(), Kind = "Purchase", OccurredOn = new DateOnly(2026, 10, 9), Amount = 30m, Currency = "USD", Description = "Printer paper",
            Supplier = "Isolated stationer", EvidenceReference = "Receipt 4411"
        }, default);
        var mistake = await ledger.SaveAsync(x.Parish, null, new SaveOfficeEntryDto
        {
            OperationId = Guid.NewGuid(), Kind = "Purchase", OccurredOn = new DateOnly(2026, 10, 10), Amount = 500000m, Currency = "LBP", Description = "Tea",
            Supplier = "Isolated shop", MissingEvidenceReason = "Market stall gives no receipts"
        }, default);
        Assert.Equal("Removed", (await ledger.ActAsync(x.Parish, mistake.Id, new OfficeEntryActionDto { OperationId = Guid.NewGuid(), Version = mistake.Version, Action = "remove", Reason = "Entered twice" }, default)).Status);
        var close = new CloseOfficeMonthDto { OperationId = Guid.NewGuid(), Period = "2026-10" };
        await Assert.ThrowsAsync<DomainException>(() => ledger.CloseMonthAsync(x.Parish, close, default));

        f.As(x.Treasurer);
        var october = await ledger.CloseMonthAsync(x.Parish, close, default);
        Assert.Equal((50m, 100m, 30m, 120m), (october.Totals["USD"].Opening, october.Totals["USD"].In, october.Totals["USD"].Out, october.Totals["USD"].Closing));
        f.As(x.Counter);
        var closedPurchase = (await ledger.EntriesAsync(x.Parish, "2026-10", default)).Single(e => e.Id == purchase.Id);
        Assert.True(closedPurchase.MonthClosed);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => ledger.ActAsync(x.Parish, purchase.Id,
            new OfficeEntryActionDto { OperationId = Guid.NewGuid(), Version = closedPurchase.Version, Action = "remove", Reason = "Wrong" }, default))).Code);
        var reversal = await ledger.ActAsync(x.Parish, purchase.Id, new OfficeEntryActionDto
        {
            OperationId = Guid.NewGuid(), Version = closedPurchase.Version, Action = "reverse", OccurredOn = new DateOnly(2026, 11, 3), Reason = "Paper was returned"
        }, default);
        Assert.Equal(("Reversal", purchase.Id), (reversal.Kind, reversal.ReversalOf));
        var now = await ledger.BalancesAsync(x.Parish, default);
        Assert.Equal((120m, 30m, 150m), (now.Totals["USD"].Opening, now.Totals["USD"].In, now.Totals["USD"].Closing));
        Assert.Empty(now.NegativeCurrencies);
    }

    private static SaveOfficeEntryDto Allowance(decimal amount, string currency, DateOnly on) => new()
    {
        OperationId = Guid.NewGuid(), Kind = "Allowance", OccurredOn = on, Amount = amount, Currency = currency, Description = "Monthly office allowance",
        FinanceReference = "Isolated transfer voucher 7"
    };

    private static Task<BankLineDto> MatchAsync(BankReconciliationService bank, Setup x, BankLineDto line, params (string Kind, string? Record, decimal Amount)[] parts)
        => bank.ActAsync(x.Parish, line.Id, new BankLineActionDto
        {
            OperationId = Guid.NewGuid(), Version = line.Version, Action = "match",
            Allocations = parts.Select(p => new BankAllocationDto { Kind = p.Kind, RecordId = p.Record, Amount = p.Amount }).ToArray()
        }, default);

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "finance"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        return new Setup(f, staff, appointment.Id,
            await GrantAsync(staff, [Permissions.FinanceApprove, Permissions.FinanceRead]),
            await GrantAsync(staff, [Permissions.FinanceEnter, Permissions.FinanceRead]),
            await GrantAsync(staff, [Permissions.FinanceEnter, Permissions.FinanceRead]),
            await GrantAsync(staff, [Permissions.FinancePost, Permissions.FinanceRead]));
    }

    private static async Task<string> GrantAsync(StaffAppointmentScenario staff, string[] allows)
    {
        var account = await staff.Fixture.CreateVerifiedStaffAsync();
        staff.Fixture.As(staff.Fixture.FirstAdmin);
        await staff.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version, AccountId = Guid.Parse(account), Allows = allows,
            StartsAt = staff.Fixture.Clock.Now
        }, default);
        return account;
    }

    private static async Task<string> PersonAsync(Setup x)
    {
        x.Priest();
        return (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Donor", BirthDate = new DateOnly(1970, 1, 1)
        }, default)).Id;
    }

    private static async Task<string> HouseholdAsync(Setup x, string envelope)
    {
        x.Priest();
        return (await x.F.Services.GetRequiredService<HouseholdService>().SaveAsync(x.Parish, null, new SaveHouseholdDto { OperationId = Guid.NewGuid(), Name = "Isolated household", EnvelopeId = envelope }, default)).Id;
    }

    private static async Task<(string Account, string Person)> LinkedMemberAsync(Setup x)
    {
        var account = await x.F.CreateVerifiedMemberAsync();
        var person = await PersonAsync(x);
        x.Priest();
        await x.F.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity"
        }, default);
        return (account, person);
    }

    private static GiftLineDto Line(string key, decimal amount, string currency, string method, string fund, string? person = null, string? envelope = null,
        bool anonymous = false, string? campaign = null) => new()
    {
        Key = key, Amount = amount, Currency = currency, Method = method, FundId = Guid.Parse(fund), PersonId = person is null ? null : Guid.Parse(person),
        EnvelopeId = envelope, Anonymous = anonymous, CampaignId = campaign is null ? null : Guid.Parse(campaign)
    };

    private static CurrencyTotalDto[] Totals(params (string Currency, string Method, decimal Amount)[] totals)
        => totals.Select(t => new CurrencyTotalDto { Currency = t.Currency, Method = t.Method, Amount = t.Amount }).ToArray();

    private static async Task<CountSessionDto> SaveLinesAsync(Setup x, string session, params GiftLineDto[] lines)
        => await x.Giving.SaveLinesAsync(x.Parish, session, new SaveLinesDto { OperationId = Guid.NewGuid(), Version = await VersionAsync<CountSession>(x, "countSession:" + session), Lines = lines }, default);

    private static async Task<CountSessionDto> VerifyAsync(Setup x, string session, int revision, CurrencyTotalDto[] observed)
        => await x.Giving.VerifyAsync(x.Parish, session, new VerifySessionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<CountSession>(x, "countSession:" + session), Revision = revision, Observed = observed, Note = "Isolated count"
        }, default);

    private static async Task<CountSessionDto> PostAsync(Setup x, string session)
        => await x.Giving.PostAsync(x.Parish, session, new PostSessionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync<CountSession>(x, "countSession:" + session) }, default);

    // Counts, verifies and posts lines through the three separate roles, returning the posted gifts.
    private static async Task<IReadOnlyList<ContributionDto>> PostedAsync(Setup x, params GiftLineDto[] lines)
    {
        x.F.As(x.Counter);
        var session = await x.Giving.OpenSessionAsync(x.Parish, new OpenSessionDto { OperationId = Guid.NewGuid(), Source = "Isolated collection", CollectedOn = new DateOnly(2026, 11, 1) }, default);
        var saved = await SaveLinesAsync(x, session.Id, lines);
        x.F.As(x.Verifier);
        await VerifyAsync(x, session.Id, saved.Revision, saved.Totals);
        x.F.As(x.Poster);
        await PostAsync(x, session.Id);
        return (await x.Giving.ContributionsAsync(x.Parish, null, null, default)).Select(c => c.Value).Where(c => c.SessionId == session.Id).ToArray();
    }

    private static async Task<PledgeDto> AllocateAsync(Setup x, string pledge, string gift, decimal amount)
        => await x.Giving.AllocateAsync(x.Parish, pledge, new AllocatePledgeDto { OperationId = Guid.NewGuid(), ContributionId = Guid.Parse(gift), Amount = amount }, default);

    private static SaveExpenseDto Expense(string fund, string? evidence, string? missing) => new()
    {
        OperationId = Guid.NewGuid(), Description = "Candles", FundId = Guid.Parse(fund), Payee = "Isolated supplier", IncurredOn = new DateOnly(2026, 11, 1),
        Amount = 120m, Currency = "USD", EvidenceReference = evidence, MissingEvidenceReason = missing
    };

    private static async Task<ExpenseDto> ExpenseActAsync(Setup x, string expense, string action, DateOnly? paidOn = null)
        => await x.Expenses.ActAsync(x.Parish, expense, new ExpenseActionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<Expense>(x, "expense:" + expense), Action = action, PaidOn = paidOn,
            PaymentReference = paidOn is null ? null : "Isolated cash voucher 12"
        }, default);

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync<T>(Setup x, string key)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<T>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, key, default))!.Version;
}
