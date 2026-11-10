// Purpose: verifies ministry stock and loans (WF29) through real local services and storage.
// Main tests: request→approve→issue→return→check→close with stock reconciliation and safe own view; missing items and stock limits;
// departed members keep only the return route; custody duty, delegation and stranger boundaries.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryResourceTests
{
    private sealed record Setup(LocalBackendFixture F, MinistryScenario S, string Ministry, string Custodian,
        (string AccountId, string PersonId, string Username) Member)
    {
        public MinistryResourceService Service => F.Services.GetRequiredService<MinistryResourceService>();
        public string Parish => S.Parish;
    }

    [Fact]
    public async Task Loan_lifecycle_reconciles_stock_and_keeps_condition_details_with_the_custodian()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var stock = await StockAsync(x, total: 2);

        f.As(x.Member.AccountId, mfa: false);
        var visible = Assert.Single((await x.Service.AvailableStockAsync(x.Parish, x.Ministry, 25, null, default)).Items).Value;
        Assert.Equal(2, visible.Available);
        Assert.Null(visible.Storage);
        var loan = await x.Service.RequestAsync(x.Parish, x.Ministry, Request(stock.Id, 2), default);
        Assert.Equal("Requested", loan.Status);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, loan.Id, "approve"));

        f.As(x.Custodian);
        await ActAsync(x, loan.Id, "approve");
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, loan.Id, "issue", r => r.Condition = "Good"))).Code);
        var issued = await ActAsync(x, loan.Id, "issue", r => { r.Condition = "Good"; r.DueAt = f.Clock.Now.AddDays(7); });
        Assert.Equal("Issued", issued.Status);
        Assert.Equal(0, (await StockRowAsync(x, stock.Id)).Total - (await StockRowAsync(x, stock.Id)).OnLoan);

        // The last units are out, so a second request cannot be approved.
        var other = await x.Service.RequestAsync(x.Parish, x.Ministry, Request(stock.Id, 1, x.Member.PersonId), default);
        Assert.Equal("invalid_loan_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, other.Id, "approve"))).Code);

        await ActAsync(x, loan.Id, "return", r => r.Condition = "One case scratched");
        Assert.Equal(0, (await StockRowAsync(x, stock.Id)).OnLoan);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, loan.Id, "check", r => r.Outcome = "Damaged"))).Code);
        var damaged = await ActAsync(x, loan.Id, "check", r => { r.Outcome = "Damaged"; r.Evidence = "Isolated photo of the scratch"; });
        Assert.True(damaged.FollowUpRequired);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, loan.Id, "close"));
        Assert.Equal("Closed", (await ActAsync(x, loan.Id, "close", r => r.Reason = "Repaired by the group; no charge")).Status);

        f.As(x.Member.AccountId, mfa: false);
        var own = (await x.Service.OwnAsync(x.Parish, x.Ministry, 25, null, default)).Items.Single(l => l.Value.Id == loan.Id).Value;
        Assert.Equal("Closed", own.Status);
        Assert.Equal("Damaged", own.Outcome);
        Assert.Null(own.ConditionEvidence);
        Assert.Null(own.IssuedBy);
        Assert.Null(own.FollowUpResolution);

        f.As(x.Custodian);
        var history = (await x.Service.HistoryAsync(x.Parish, x.Ministry, x.Member.PersonId, 100, null, default)).Items;
        Assert.Equal(7, history.Count);
        Assert.Equal("Returned", Assert.Single(history, h => h.Action == "check").Previous!.Status);
    }

    [Fact]
    public async Task Missing_items_reduce_stock_explicitly_and_totals_never_drop_below_units_on_loan()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var stock = await StockAsync(x, total: 3);
        f.As(x.Custodian);
        var first = await IssueAsync(x, stock.Id, 1);
        var second = await IssueAsync(x, stock.Id, 1);

        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, first.Id, "report-missing", r => r.Evidence = "Isolated search record"));
        var missing = await ActAsync(x, first.Id, "report-missing", r => { r.Evidence = "Isolated search record"; r.Reason = "Not returned after retreat"; });
        Assert.Equal("Missing", missing.Outcome);
        var row = await StockRowAsync(x, stock.Id);
        Assert.Equal(2, row.Total);
        Assert.Equal(1, row.OnLoan);

        var version = (await Records(x).ReadAsync<MinistryStock>(MinistryAccess.Scope(x.Parish), "ministryStock:" + stock.Id, default))!.Version;
        Assert.Equal("invalid_loan_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveStockAsync(x.Parish, x.Ministry, stock.Id,
            new SaveStockDto { OperationId = Guid.NewGuid(), Version = version, Name = "Hymnals", Total = 0, Status = "Active" }, default))).Code);
        await x.Service.SaveStockAsync(x.Parish, x.Ministry, stock.Id,
            new SaveStockDto { OperationId = Guid.NewGuid(), Version = version, Name = "Hymnals", Total = 2, Status = "Retired" }, default);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.RequestAsync(x.Parish, x.Ministry, Request(stock.Id, 1, x.Member.PersonId), default));
        // Retiring stock still lets outstanding loans come back.
        Assert.Equal("Returned", (await ActAsync(x, second.Id, "return", r => r.Condition = "Good")).Status);
    }

    [Fact]
    public async Task Departed_members_keep_only_the_return_route_for_outstanding_loans()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var stock = await StockAsync(x, total: 2);
        f.As(x.Custodian);
        var loan = await IssueAsync(x, stock.Id, 1);

        f.Clock.Now = f.Clock.Now.AddHours(1);
        var leave = await x.S.ApplyAsync(x.Ministry, x.Member.AccountId, "Leave");
        await x.S.ApplicationActionAsync(x.Ministry, leave.Id, "approve");

        f.As(x.Member.AccountId, mfa: false);
        Assert.Equal("Issued", Assert.Single((await x.Service.OwnAsync(x.Parish, x.Ministry, 25, null, default)).Items).Value.Status);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.AvailableStockAsync(x.Parish, x.Ministry, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.RequestAsync(x.Parish, x.Ministry, Request(stock.Id, 1), default));
        f.As(x.Custodian);
        Assert.Equal("Returned", (await ActAsync(x, loan.Id, "return", r => r.Condition = "Good")).Status);
    }

    [Fact]
    public async Task Custody_is_an_explicit_duty_and_only_the_borrower_or_custodian_cancels_a_request()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var stock = await StockAsync(x, total: 1);
        var plain = await f.CreateVerifiedStaffAsync();
        await AppointAsync(x.S, x.Ministry, plain, null);
        f.As(plain);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.ListAsync(x.Parish, x.Ministry, null, 25, null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.ListStockAsync(x.Parish, x.Ministry, 25, null, default));

        f.As(x.Member.AccountId, mfa: false);
        var loan = await x.Service.RequestAsync(x.Parish, x.Ministry, Request(stock.Id, 1), default);
        var stranger = await x.S.LinkedApplicantAsync();
        f.As(stranger.AccountId, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, loan.Id, "cancel", r => r.Reason = "Not mine"));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.RequestAsync(x.Parish, x.Ministry, Request(stock.Id, 1), default));
        f.As(x.Member.AccountId, mfa: false);
        Assert.Equal("Cancelled", (await ActAsync(x, loan.Id, "cancel", r => r.Reason = "No longer needed")).Status);

        var limited = await MinistryScenario.CreateAsync(f);
        var group = await limited.MinistryAsync();
        var candidate = await f.CreateVerifiedStaffAsync();
        await Assert.ThrowsAsync<DomainException>(() => AppointAsync(limited, group.Id, candidate, "resources.custody"));
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesResourcesManage]);
        var group = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync();
        var join = await s.ApplyAsync(group.Id, member.AccountId);
        await s.ApplicationActionAsync(group.Id, join.Id, "approve");
        var custodian = await f.CreateVerifiedStaffAsync();
        await AppointAsync(s, group.Id, custodian, "resources.custody");
        return new Setup(f, s, group.Id, custodian, member);
    }

    private static async Task AppointAsync(MinistryScenario s, string ministry, string account, string? duty)
    {
        s.Use();
        await s.Fixture.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, ministry, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, ministry, default)).Version,
            AccountId = Guid.Parse(account), Role = "Leader", Duties = duty is null ? [] : [duty], StartsAt = s.Fixture.Clock.Now,
            EvidenceReference = "Isolated custody appointment"
        }, default);
    }

    private static async Task<MinistryStockDto> StockAsync(Setup x, int total)
    {
        x.F.As(x.Custodian);
        return await x.Service.SaveStockAsync(x.Parish, x.Ministry, null, new SaveStockDto
        {
            OperationId = Guid.NewGuid(), Name = "Hymnals", Storage = "Isolated sacristy cupboard", Total = total, Status = "Active"
        }, default);
    }

    private static RequestLoanDto Request(string stock, int quantity, string? person = null) => new()
    {
        OperationId = Guid.NewGuid(), StockId = Guid.Parse(stock), Quantity = quantity, Purpose = "Isolated retreat",
        PersonId = person is null ? null : Guid.Parse(person)
    };

    private static async Task<MinistryLoanDto> IssueAsync(Setup x, string stock, int quantity)
    {
        var loan = await x.Service.RequestAsync(x.Parish, x.Ministry, Request(stock, quantity, x.Member.PersonId), default);
        await ActAsync(x, loan.Id, "approve");
        return await ActAsync(x, loan.Id, "issue", r => { r.Condition = "Good"; r.DueAt = x.F.Clock.Now.AddDays(7); });
    }

    private static async Task<MinistryLoanDto> ActAsync(Setup x, string loan, string action, Action<LoanActionDto>? configure = null)
    {
        var request = new LoanActionDto
        {
            OperationId = Guid.NewGuid(), Action = action,
            Version = (await Records(x).ReadAsync<MinistryLoan>(MinistryAccess.Scope(x.Parish), "ministryLoan:" + loan, default))!.Version
        };
        configure?.Invoke(request);
        return await x.Service.ActAsync(x.Parish, x.Ministry, loan, request, default);
    }

    private static async Task<MinistryStock> StockRowAsync(Setup x, string stock)
        => (await Records(x).ReadAsync<MinistryStock>(MinistryAccess.Scope(x.Parish), "ministryStock:" + stock, default))!.Value;

    private static IRecordTransactions Records(Setup x) => x.F.Services.GetRequiredService<IRecordTransactions>();
}
