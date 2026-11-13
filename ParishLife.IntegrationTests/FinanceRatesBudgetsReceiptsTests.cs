// Purpose: verifies parish-recorded exchange rates, fund budgets, recurring gifts and numbered receipts through real local services, isolated
// storage and (for the routes and their authorization) real HTTP with MFA cookies and CSRF.
// Main tests: Exchange_rates_are_recorded_with_date_and_source_and_never_convert_amounts, Budgets_compare_with_actual_payments_per_currency,
// Recurring_gifts_are_schedules_that_never_create_gifts, Receipts_are_numbered_once_per_gift_and_voids_keep_their_number,
// Concurrent_receipts_take_distinct_consecutive_numbers, Finance_record_routes_require_finance_permissions_over_HTTP.

using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Finance;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public partial class FinanceTests
{
    [Fact]
    public async Task Exchange_rates_are_recorded_with_date_and_source_and_never_convert_amounts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var rates = f.Services.GetRequiredService<ExchangeRateService>();
        RecordExchangeRateDto Rate(decimal rate, DateOnly on, string source = "Isolated published rate", string quote = "LBP") => new()
        {
            OperationId = Guid.NewGuid(), BaseCurrency = "USD", QuoteCurrency = quote, Rate = rate, EffectiveOn = on, Source = source
        };

        f.As(x.Counter);
        await Assert.ThrowsAsync<DomainException>(() => rates.RecordAsync(x.Parish, Rate(89500m, new DateOnly(2026, 11, 1)), default));
        f.As(x.Treasurer);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => rates.RecordAsync(x.Parish, Rate(89500m, new DateOnly(2026, 11, 20)), default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => rates.RecordAsync(x.Parish, Rate(1m, new DateOnly(2026, 11, 1), quote: "USD"), default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => rates.RecordAsync(x.Parish, Rate(1.1234567m, new DateOnly(2026, 11, 1)), default))).Code);
        var first = await rates.RecordAsync(x.Parish, Rate(89500m, new DateOnly(2026, 11, 1)), default);
        Assert.Equal((x.Treasurer, "Isolated published rate"), (first.RecordedBy, first.Source));
        var correction = await rates.RecordAsync(x.Parish, Rate(89700m, new DateOnly(2026, 11, 1), "Isolated corrected rate"), default);
        await rates.RecordAsync(x.Parish, Rate(0.92m, new DateOnly(2026, 11, 2), quote: "EUR"), default);

        f.As(x.Poster);
        Assert.Equal(correction.Id, (await rates.CurrentAsync(x.Parish, "USD", "LBP", null, default)).Id);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => rates.CurrentAsync(x.Parish, "USD", "LBP", new DateOnly(2026, 10, 31), default))).Kind);
        Assert.Equal(2, (await rates.ListAsync(x.Parish, "USD", "LBP", default)).Count);
        Assert.Equal(3, (await rates.ListAsync(x.Parish, null, null, default)).Count);

        // Recording a rate leaves every stored amount in its own currency.
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        await PostedAsync(x, Line("a", 500000m, "LBP", "Cash", fund.Id));
        f.As(x.Treasurer);
        Assert.Equal(("LBP", 500000m), (Assert.Single(await x.Expenses.BalancesAsync(x.Parish, default)).Currency, Assert.Single(await x.Expenses.BalancesAsync(x.Parish, default)).Balance));

        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => rates.ListAsync(x.Parish, null, null, default));
    }

    [Fact]
    public async Task Budgets_compare_with_actual_payments_per_currency()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var budgets = f.Services.GetRequiredService<FundBudgetService>();
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        SaveFundBudgetDto Budget(decimal amount, string currency = "USD", string? version = null) => new()
        {
            OperationId = Guid.NewGuid(), Version = version, FundId = Guid.Parse(fund.Id), Year = 2026, Currency = currency, Amount = amount
        };

        f.As(x.Counter);
        await Assert.ThrowsAsync<DomainException>(() => budgets.SaveAsync(x.Parish, Budget(1000m), default));
        f.As(x.Treasurer);
        var set = await budgets.SaveAsync(x.Parish, Budget(1000m), default);
        Assert.Equal((1000m, 0m, 1000m), (set.Amount, set.Spent, set.Remaining));
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => budgets.SaveAsync(x.Parish, Budget(900m), default))).Code);
        var raised = await budgets.SaveAsync(x.Parish, Budget(1200m, version: set.Version), default);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => budgets.SaveAsync(x.Parish, Budget(800m, version: set.Version), default))).Code);
        await budgets.SaveAsync(x.Parish, Budget(50000000m, "LBP"), default);

        await PostedAsync(x, Line("a", 500m, "USD", "Cash", fund.Id));
        f.As(x.Counter);
        var expense = await x.Expenses.SaveAsync(x.Parish, null, Expense(fund.Id, "Invoice 3", null), default);
        await ExpenseActAsync(x, expense.Id, "submit");
        f.As(x.Treasurer);
        await ExpenseActAsync(x, expense.Id, "approve");
        f.As(x.Poster);
        await ExpenseActAsync(x, expense.Id, "record-payment", paidOn: new DateOnly(2026, 11, 2));

        var listed = await budgets.ListAsync(x.Parish, 2026, default);
        var usd = listed.Single(b => b.Currency == "USD");
        Assert.Equal((1200m, 120m, 1080m, raised.Version), (usd.Amount, usd.Spent, usd.Remaining, usd.Version));
        Assert.Equal(0m, listed.Single(b => b.Currency == "LBP").Spent);
        Assert.Empty(await budgets.ListAsync(x.Parish, 2027, default));
    }

    [Fact]
    public async Task Recurring_gifts_are_schedules_that_never_create_gifts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        var service = f.Services.GetRequiredService<RecurringGiftService>();
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        SaveRecurringGiftDto Gift(string? version = null, decimal amount = 50m) => new()
        {
            OperationId = Guid.NewGuid(), Version = version, PersonId = Guid.Parse(person), FundId = Guid.Parse(fund.Id), Amount = amount, Currency = "USD",
            Frequency = "Monthly", Method = "Bank", StartsOn = new DateOnly(2026, 10, 15), EndsOn = new DateOnly(2027, 10, 15)
        };

        f.As(x.Poster);
        await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(x.Parish, null, Gift(), default));
        f.As(x.Counter);
        var noGiver = Gift();
        noGiver.PersonId = null;
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(x.Parish, null, noGiver, default))).Code);
        var gift = await service.SaveAsync(x.Parish, null, Gift(), default);
        Assert.Equal(("Active", new DateOnly(2026, 11, 15)), (gift.Status, gift.NextExpectedOn));
        Assert.Contains("never charges", gift.Notice);
        var edited = await service.SaveAsync(x.Parish, gift.Id, Gift(gift.Version, 60m), default);
        Assert.Equal(60m, edited.Amount);

        var paused = await service.ActAsync(x.Parish, gift.Id, new RecurringGiftActionDto { OperationId = Guid.NewGuid(), Version = edited.Version, Action = "pause" }, default);
        Assert.Null(paused.NextExpectedOn);
        var resumed = await service.ActAsync(x.Parish, gift.Id, new RecurringGiftActionDto { OperationId = Guid.NewGuid(), Version = paused.Version, Action = "resume" }, default);
        Assert.Equal(new DateOnly(2026, 11, 15), resumed.NextExpectedOn);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => service.ActAsync(x.Parish, gift.Id,
            new RecurringGiftActionDto { OperationId = Guid.NewGuid(), Version = resumed.Version, Action = "end" }, default))).Code);
        var ended = await service.ActAsync(x.Parish, gift.Id, new RecurringGiftActionDto { OperationId = Guid.NewGuid(), Version = resumed.Version, Action = "end", Reason = "Giver moved away" }, default);
        Assert.Equal(("Ended", (DateOnly?)null), (ended.Status, ended.NextExpectedOn));
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(x.Parish, gift.Id, Gift(ended.Version), default))).Code);

        // A schedule is never a gift: nothing was posted, so there are no contributions and no balance.
        f.As(x.Treasurer);
        Assert.Single(await service.ListAsync(x.Parish, default));
        Assert.Empty(await x.Giving.ContributionsAsync(x.Parish, null, null, default));
        Assert.Empty(await x.Expenses.BalancesAsync(x.Parish, default));
    }

    [Fact]
    public async Task Receipts_are_numbered_once_per_gift_and_voids_keep_their_number()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        var household = await HouseholdAsync(x, "E-12");
        var receipts = f.Services.GetRequiredService<GiftReceiptService>();
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        var gifts = await PostedAsync(x,
            Line("a", 100m, "USD", "Cash", fund.Id, person: person),
            Line("b", 20m, "USD", "Cash", fund.Id, anonymous: true),
            Line("c", 300000m, "LBP", "Cash", fund.Id, envelope: "E-12"),
            Line("d", 40m, "USD", "Cash", fund.Id, person: person));
        IssueReceiptDto Issue(ContributionDto gift) => new() { OperationId = Guid.NewGuid(), ContributionId = gift.Id };
        var personal = gifts.Single(g => g.Amount == 100m);

        f.As(x.Counter);
        await Assert.ThrowsAsync<DomainException>(() => receipts.IssueAsync(x.Parish, Issue(personal), default));
        f.As(x.Poster);
        var first = await receipts.IssueAsync(x.Parish, Issue(personal), default);
        Assert.Equal((1L, person, 100m, "Issued", "Posted"), (first.Number, first.PersonId, first.Amount, first.Status, first.GiftStatus));
        Assert.Contains("not a tax receipt", first.Notice);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => receipts.IssueAsync(x.Parish, Issue(personal), default))).Code);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => receipts.IssueAsync(x.Parish, Issue(gifts.Single(g => g.Anonymous)), default))).Code);
        var second = await receipts.IssueAsync(x.Parish, Issue(gifts.Single(g => g.Currency == "LBP")), default);
        Assert.Equal((2L, household), (second.Number, second.HouseholdId));
        var replay = new IssueReceiptDto { OperationId = Guid.NewGuid(), ContributionId = gifts.Single(g => g.Amount == 40m).Id };
        var third = await receipts.IssueAsync(x.Parish, replay, default);
        Assert.Equal((3L, third.Id), ((await receipts.IssueAsync(x.Parish, replay, default)).Number, (await receipts.IssueAsync(x.Parish, replay, default)).Id));

        // The gift is reversed: the office voids its receipt, the number stays used and is never reissued.
        f.As(x.Treasurer);
        var stored = (await x.Giving.ContributionsAsync(x.Parish, null, null, default)).Single(g => g.Value.Id == personal.Id);
        await x.Giving.CorrectAsync(x.Parish, personal.Id, new CorrectContributionDto { OperationId = Guid.NewGuid(), Version = stored.Version, Action = "reverse", Reason = "Counted twice" }, default);
        Assert.Equal("Reversed", (await receipts.ListAsync(x.Parish, default)).Single(r => r.Number == 1).GiftStatus);
        f.As(x.Poster);
        await Assert.ThrowsAsync<DomainException>(() => receipts.VoidAsync(x.Parish, first.Id, new VoidReceiptDto { OperationId = Guid.NewGuid(), Version = first.Version, Reason = "Gift reversed" }, default));
        f.As(x.Treasurer);
        var voided = await receipts.VoidAsync(x.Parish, first.Id, new VoidReceiptDto { OperationId = Guid.NewGuid(), Version = first.Version, Reason = "Gift reversed" }, default);
        Assert.Equal(("Voided", 1L, x.Treasurer), (voided.Status, voided.Number, voided.VoidedBy));
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => receipts.VoidAsync(x.Parish, first.Id,
            new VoidReceiptDto { OperationId = Guid.NewGuid(), Version = voided.Version, Reason = "Again" }, default))).Code);
        Assert.Equal(new long[] { 3, 2, 1 }, (await receipts.ListAsync(x.Parish, default)).Select(r => r.Number).ToArray());
        f.As(x.Poster);
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => receipts.IssueAsync(x.Parish, Issue(personal), default))).Code);
    }

    [Fact]
    public async Task Concurrent_receipts_take_distinct_consecutive_numbers()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        var receipts = f.Services.GetRequiredService<GiftReceiptService>();
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        var gifts = await PostedAsync(x, Enumerable.Range(1, 5).Select(i => Line("g" + i, i, "USD", "Cash", fund.Id, person: person)).ToArray());

        f.As(x.Poster);
        // Five issues race for the counter: every gift gets exactly one receipt and no number is used twice or skipped.
        var issued = await Task.WhenAll(gifts.Select(g => receipts.IssueAsync(x.Parish, new IssueReceiptDto { OperationId = Guid.NewGuid(), ContributionId = g.Id }, default)));
        Assert.Equal(new long[] { 1, 2, 3, 4, 5 }, issued.Select(r => r.Number).Order().ToArray());
        Assert.Equal(5, issued.Select(r => r.ContributionId).Distinct().Count());
        var counter = await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<GiftReceiptCounter>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "giftReceiptCounter", default);
        Assert.Equal(6L, counter!.Value.Next);
        Assert.Equal(5, (await receipts.ListAsync(x.Parish, default)).Count);
    }

    [Fact]
    public async Task Finance_record_routes_require_finance_permissions_over_HTTP()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        using var treasurer = factory.Client();
        using var counter = factory.Client();
        await AuthHttp.LoginAsync(treasurer, (await users.FindByIdAsync(x.Treasurer))!.UserName!);
        await AuthHttp.LoginAsync(counter, (await users.FindByIdAsync(x.Counter))!.UserName!);
        var root = $"/api/parishes/{x.Parish}/finance";
        var rate = new RecordExchangeRateDto
        {
            OperationId = Guid.NewGuid(), BaseCurrency = "USD", QuoteCurrency = "LBP", Rate = 89500m, EffectiveOn = DateOnly.FromDateTime(f.Clock.Now.UtcDateTime),
            Source = "Isolated published rate"
        };

        // A signed-in account without the needed finance permission is answered as if the parish record were not there (no disclosure).
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(root + "/receipts")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await counter.PostAsJsonAsync(root + "/exchange-rates", rate)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await treasurer.PostAsJsonAsync(root + "/exchange-rates", new { operationId = Guid.NewGuid(), baseCurrency = "usd", quoteCurrency = "LBP", rate = 1, source = "x" })).StatusCode);
        var recorded = await AuthHttp.Read<ExchangeRateDto>(await treasurer.PostAsJsonAsync(root + "/exchange-rates", rate));
        Assert.Equal(89500m, recorded.Rate);
        Assert.Equal(recorded.Id, (await AuthHttp.Read<ExchangeRateDto>(await counter.GetAsync(root + "/exchange-rates/current?baseCurrency=USD&quoteCurrency=LBP"))).Id);
        Assert.Equal(HttpStatusCode.NotFound, (await counter.GetAsync(root + "/exchange-rates/current?baseCurrency=USD&quoteCurrency=EUR")).StatusCode);
        Assert.Empty(await AuthHttp.Read<GiftReceiptDto[]>(await counter.GetAsync(root + "/receipts")));
        Assert.Empty(await AuthHttp.Read<RecurringGiftDto[]>(await counter.GetAsync(root + "/recurring-gifts")));
        Assert.Empty(await AuthHttp.Read<FundBudgetDto[]>(await counter.GetAsync(root + "/budgets?year=2026")));
        Assert.Empty(await AuthHttp.Read<object[]>(await counter.GetAsync(root + "/sessions")));
        Assert.Equal(HttpStatusCode.NotFound, (await counter.PostAsJsonAsync(root + "/receipts", new IssueReceiptDto { OperationId = Guid.NewGuid(), ContributionId = new string('a', 32) })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await counter.PutAsJsonAsync(root + "/budgets", new SaveFundBudgetDto
        {
            OperationId = Guid.NewGuid(), FundId = Guid.NewGuid(), Year = 2026, Currency = "USD", Amount = 1m
        })).StatusCode);
        Assert.Empty(await AuthHttp.Read<object[]>(await counter.GetAsync($"/api/parishes/{x.Parish}/office-ledger/openings")));
    }
}
