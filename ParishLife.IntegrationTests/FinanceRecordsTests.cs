// Purpose: verifies the finance additions for the full stack through real local services and isolated storage: Arabic twins and name
// edits of funds and campaigns, the counting-session list, office categories and the openings list.
// Main tests: Arabic_twins_are_stored_as_typed_and_names_are_corrected_without_changing_restriction_or_fund,
// Sessions_list_and_office_openings_are_readable_by_finance_readers_only. Shares the setup helpers in FinanceTests.cs.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Finance;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public partial class FinanceTests
{
    [Fact]
    public async Task Arabic_twins_are_stored_as_typed_and_names_are_corrected_without_changing_restriction_or_fund()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Treasurer);
        var plain = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        Assert.Null(plain.NameAr);
        var roof = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto
        {
            OperationId = Guid.NewGuid(), Name = "Roof", NameAr = "  صندوق السقف ", Purpose = "Roof repair", PurposeAr = "ترميم السقف", Restricted = true
        }, default);
        Assert.Equal(("صندوق السقف", "ترميم السقف"), (roof.NameAr, roof.PurposeAr));
        Assert.False(string.IsNullOrEmpty(roof.Version));

        // A restriction never changes; names change only with the current version, and only by an approver.
        var edit = new SaveFundDto { OperationId = Guid.NewGuid(), Version = plain.Version, Name = "General fund", NameAr = "الصندوق العام", Purpose = "Operations", Restricted = true };
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => x.Giving.UpdateFundAsync(x.Parish, plain.Id, edit, default))).Code);
        edit.Restricted = false;
        f.As(x.Counter);
        await Assert.ThrowsAsync<DomainException>(() => x.Giving.UpdateFundAsync(x.Parish, plain.Id, edit, default));
        f.As(x.Treasurer);
        var renamed = await x.Giving.UpdateFundAsync(x.Parish, plain.Id, edit, default);
        Assert.Equal(("General fund", "الصندوق العام"), (renamed.Name, renamed.NameAr));
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Giving.UpdateFundAsync(x.Parish, plain.Id,
            new SaveFundDto { OperationId = Guid.NewGuid(), Version = plain.Version, Name = "Stale", Purpose = "Operations" }, default))).Code);

        var campaign = await x.Giving.CreateCampaignAsync(x.Parish, new SaveCampaignDto
        {
            OperationId = Guid.NewGuid(), Name = "Roof appeal", Purpose = "Repair", FundId = Guid.Parse(roof.Id), StartsOn = new DateOnly(2026, 10, 1),
            Targets = new() { ["USD"] = 1000m }
        }, default);
        Assert.Null(campaign.NameAr);
        var moved = new SaveCampaignDto
        {
            OperationId = Guid.NewGuid(), Version = campaign.Version, Name = "Roof appeal", NameAr = "حملة السقف", Purpose = "Repair", FundId = Guid.Parse(renamed.Id),
            StartsOn = new DateOnly(2026, 10, 1), Targets = new() { ["USD"] = 1000m }
        };
        Assert.Equal("invalid_finance_state", (await Assert.ThrowsAsync<DomainException>(() => x.Giving.UpdateCampaignAsync(x.Parish, campaign.Id, moved, default))).Code);
        moved.FundId = Guid.Parse(roof.Id);
        moved.EndsOn = new DateOnly(2027, 3, 1);
        var updated = await x.Giving.UpdateCampaignAsync(x.Parish, campaign.Id, moved, default);
        Assert.Equal(("حملة السقف", new DateOnly(2027, 3, 1)), (updated.NameAr, updated.EndsOn));
        Assert.Equal("حملة السقف", Assert.Single(await x.Giving.CampaignsAsync(x.Parish, default)).NameAr);

        f.As(x.Counter);
        var expense = await x.Expenses.SaveAsync(x.Parish, null, new SaveExpenseDto
        {
            OperationId = Guid.NewGuid(), Description = "Candles", DescriptionAr = "شموع", FundId = Guid.Parse(roof.Id), Payee = "Isolated supplier",
            IncurredOn = new DateOnly(2026, 11, 1), Amount = 10m, Currency = "USD", EvidenceReference = "Invoice 1"
        }, default);
        Assert.Equal("شموع", expense.DescriptionAr);
        Assert.Equal("شموع", Assert.Single(await x.Expenses.ListAsync(x.Parish, null, default)).Value.DescriptionAr);
    }

    [Fact]
    public async Task Sessions_list_and_office_openings_are_readable_by_finance_readers_only()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Treasurer);
        var fund = await x.Giving.CreateFundAsync(x.Parish, new SaveFundDto { OperationId = Guid.NewGuid(), Name = "General", Purpose = "Operations" }, default);
        await PostedAsync(x, Line("a", 50m, "USD", "Cash", fund.Id));
        f.As(x.Counter);
        var open = await x.Giving.OpenSessionAsync(x.Parish, new OpenSessionDto { OperationId = Guid.NewGuid(), Source = "Feast collection", CollectedOn = new DateOnly(2026, 11, 2) }, default);

        var sessions = await x.Giving.SessionsAsync(x.Parish, null, default);
        Assert.Equal(2, sessions.Count);
        Assert.Equal(open.Id, sessions[0].Value.Id);
        Assert.Equal([x.Counter], sessions[0].Value.CountedBy);
        Assert.False(string.IsNullOrEmpty(sessions[0].Version));
        Assert.Equal("Posted", Assert.Single(await x.Giving.SessionsAsync(x.Parish, "posted", default)).Value.Status);

        var ledger = f.Services.GetRequiredService<OfficeLedgerService>();
        f.As(x.Treasurer);
        await ledger.OpenAsync(x.Parish, new OfficeOpeningDto { OperationId = Guid.NewGuid(), Currency = "USD", Amount = 40m, EffectiveOn = new DateOnly(2026, 10, 1), Provenance = "Isolated count" }, default);
        f.As(x.Counter);
        var entry = await ledger.SaveAsync(x.Parish, null, new SaveOfficeEntryDto
        {
            OperationId = Guid.NewGuid(), Kind = "Purchase", OccurredOn = new DateOnly(2026, 10, 9), Amount = 5m, Currency = "USD", Description = "Paper",
            DescriptionAr = "ورق", Category = "Stationery", Supplier = "Isolated stationer", EvidenceReference = "Receipt 1"
        }, default);
        Assert.Equal(("ورق", "Stationery"), (entry.DescriptionAr, entry.Category));
        var opening = Assert.Single(await ledger.OpeningsAsync(x.Parish, default));
        Assert.Equal(("USD", 40m, "Isolated count", x.Treasurer), (opening.Currency, opening.Amount, opening.Provenance, opening.EnteredBy));

        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Giving.SessionsAsync(x.Parish, null, default));
        await Assert.ThrowsAsync<DomainException>(() => ledger.OpeningsAsync(x.Parish, default));
    }
}
