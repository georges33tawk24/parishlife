// Purpose: verifies future-coverage payer transfers between a parish and an archdiocese (SUB09) through real local services and storage.
// Main tests: both directions with both approvals, sponsored invoicing and unchanged history; exact-version decisions and replay; dates never
// retroactive or over paid time; expiry, decline and proposer-only cancel; payer-aware invoice/cash guards; wrong actor, capacity and MFA refusals.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Billing;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PayerTransferTests
{
    private static PayerTransferService Transfers(LocalBackendFixture f) => f.Services.GetRequiredService<PayerTransferService>();

    private static ProposePayerTransferDto Proposal(LocalBackendFixture f, string direction, DateTimeOffset effective, DateTimeOffset? acceptBy = null) => new()
    {
        OperationId = Guid.NewGuid(), Direction = direction, EffectiveFrom = effective, AcceptBy = acceptBy ?? f.Clock.Now.AddDays(7), Reason = "Isolated sponsorship change"
    };

    private static async Task<PayerTransferDto> DecideAsync(LocalBackendFixture f, string account, string parish, string id, bool accept, string? version = null)
    {
        f.As(account);
        var row = await Transfers(f).GetAsync(parish, id, default);
        return await Transfers(f).DecideAsync(parish, id, new DecidePayerTransferDto { OperationId = Guid.NewGuid(), Version = version ?? row.Version, Accept = accept }, default);
    }

    private static async Task<LocalBackendFixture> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        return f;
    }

    [Fact]
    public async Task Coverage_moves_to_the_archdiocese_and_back_for_future_periods_only_with_both_approvals()
    {
        await using var f = await StartAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var now = f.Clock.Now;
        var first = await s.InvoiceAsync(now);
        var firstReceipt = await s.PayAsync(s.Parish, first.Id);
        Assert.Equal(1, await s.ActivateAsync());
        var effective = now.AddMonths(1);

        f.As(f.Other);
        var request = Proposal(f, "ToArchdiocese", effective);
        var proposed = await Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, request, default);
        Assert.Equal(("AwaitingArchdiocese", f.Other, s.Parish, s.Archdiocese), (proposed.Status, proposed.ParishApprovedBy, proposed.FromAccountId, proposed.ToAccountId));
        Assert.Equal(proposed.Id, (await Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, request, default)).Id);
        Assert.Equal("transfer_pending", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective), default))).Code);
        // The proposing side cannot also supply the other side's approval, and stale reviewed versions are refused.
        Assert.Equal("invalid_transfer_state", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, f.Other, s.Parish, proposed.Id, true))).Code);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, f.FirstAdmin, s.Parish, proposed.Id, true, "stale"))).Code);

        f.As(f.FirstAdmin);
        var reviewed = await Transfers(f).GetAsync(s.Parish, proposed.Id, default);
        var decision = new DecidePayerTransferDto { OperationId = Guid.NewGuid(), Version = reviewed.Version, Accept = true };
        var accepted = await Transfers(f).DecideAsync(s.Parish, proposed.Id, decision, default);
        Assert.Equal(("Accepted", f.FirstAdmin), (accepted.Status, accepted.ArchdioceseApprovedBy));
        Assert.Equal("Accepted", (await Transfers(f).DecideAsync(s.Parish, proposed.Id, decision, default)).Status);

        f.As(f.Other);
        var schedule = await Transfers(f).ScheduleAsync(s.Parish, default);
        Assert.Equal(s.Parish, schedule.CurrentAccountId);
        Assert.Equal((s.Archdiocese, effective), (schedule.Periods.Single().BillingAccountId, schedule.Periods.Single().EffectiveFrom));
        Assert.Equal("payer_not_parish", (await Assert.ThrowsAsync<DomainException>(() => s.InvoiceAsync(effective))).Code);

        f.As(f.FirstAdmin);
        var sponsored = await Transfers(f).CreateSponsoredInvoiceAsync(s.Archdiocese, s.Parish, new CreateInvoiceDto { OperationId = Guid.NewGuid(), PlanId = Guid.Parse(s.Plan), StartsAt = effective }, default);
        Assert.Equal((s.Archdiocese, s.Parish), (sponsored.BillingAccountId, sponsored.ParishId));
        Assert.Equal("payer_not_archdiocese", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).CreateSponsoredInvoiceAsync(s.Archdiocese, s.Parish,
            new CreateInvoiceDto { OperationId = Guid.NewGuid(), PlanId = Guid.Parse(s.Plan), StartsAt = now }, default))).Code);
        Assert.Equal("AwaitingPayment", (await Transfers(f).GetSponsoredInvoiceAsync(s.Archdiocese, sponsored.Id, default)).ActivationStatus);
        await s.PayAsync(s.Archdiocese, sponsored.Id);
        Assert.Equal(1, await s.ActivateAsync());

        f.As(f.Other);
        var coverage = await s.Billing.GetCoverageAsync(s.Parish, default);
        Assert.Equal([s.Parish, s.Archdiocese], coverage.OrderBy(c => c.StartsAt).Select(c => c.BillingAccountId).ToArray());
        // The parish's own earlier invoice and receipt are untouched; the archdiocese invoice is not in the parish billing account.
        var history = await s.Billing.GetAsync(s.Parish, first.Id, default);
        Assert.Equal(firstReceipt.Id, history.Receipts.Single().Id);
        await Assert.ThrowsAsync<DomainException>(() => s.Billing.GetAsync(s.Parish, sponsored.Id, default));

        // Back to independent payment: the archdiocese proposes, the parish owner accepts.
        var back = now.AddMonths(2);
        f.As(f.FirstAdmin);
        var returning = await Transfers(f).ProposeForArchdioceseAsync(s.Archdiocese, s.Parish, Proposal(f, "ToParish", back), default);
        Assert.Equal(("AwaitingParish", s.Archdiocese, s.Parish), (returning.Status, returning.FromAccountId, returning.ToAccountId));
        Assert.Equal("Accepted", (await DecideAsync(f, f.Other, s.Parish, returning.Id, true)).Status);
        f.As(f.FirstAdmin);
        Assert.Equal("payer_not_archdiocese", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).CreateSponsoredInvoiceAsync(s.Archdiocese, s.Parish,
            new CreateInvoiceDto { OperationId = Guid.NewGuid(), PlanId = Guid.Parse(s.Plan), StartsAt = back }, default))).Code);
        Assert.Equal(s.Parish, (await s.InvoiceAsync(back)).BillingAccountId);
        f.As(f.Other);
        Assert.Equal(2, (await Transfers(f).ScheduleAsync(s.Parish, default)).Periods.Length);
        Assert.Equal(2, (await Transfers(f).ListAsync(s.Parish, 25, null, default)).Items.Count);
    }

    [Fact]
    public async Task Dates_are_never_retroactive_or_over_paid_time_and_lapsed_or_withdrawn_proposals_stay_as_history()
    {
        await using var f = await StartAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var now = f.Clock.Now;
        f.As(f.Other);
        Assert.Equal("invalid_dates", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", now.AddDays(-1), now.AddDays(-2)), default))).Code);
        Assert.Equal("invalid_dates", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", now.AddDays(3), now.AddDays(5)), default))).Code);
        Assert.Equal("payer_mismatch", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToParish", now.AddDays(10)), default))).Code);

        // Paid coverage running past the effective date blocks acceptance: no credit or refund policy is invented.
        await s.PayAsync(s.Parish, (await s.InvoiceAsync(now)).Id);
        f.As(f.Other);
        var early = await Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", now.AddDays(10)), default);
        Assert.Equal("paid_invoice_after_effective_date", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, f.FirstAdmin, s.Parish, early.Id, true))).Code);
        Assert.Equal(1, await s.ActivateAsync());
        Assert.Equal("paid_coverage_after_effective_date", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, f.FirstAdmin, s.Parish, early.Id, true))).Code);

        // Only the proposing side withdraws; the other side declines instead.
        f.As(f.FirstAdmin);
        var row = await Transfers(f).GetAsync(s.Parish, early.Id, default);
        Assert.Equal("invalid_transfer_state", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).CancelAsync(s.Parish, early.Id,
            new CancelPayerTransferDto { OperationId = Guid.NewGuid(), Version = row.Version, Reason = "Not ours" }, default))).Code);
        f.As(f.Other);
        Assert.Equal("Cancelled", (await Transfers(f).CancelAsync(s.Parish, early.Id, new CancelPayerTransferDto { OperationId = Guid.NewGuid(), Version = row.Version, Reason = "Withdrawn" }, default)).Status);
        Assert.Equal("invalid_transfer_state", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, f.FirstAdmin, s.Parish, early.Id, true))).Code);

        // A lapsed proposal reads as Expired, cannot be accepted, and is closed when the next proposal is made.
        var effective = now.AddMonths(1);
        f.As(f.Other);
        var lapsing = await Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective, now.AddDays(1)), default);
        f.As(f.FirstAdmin);
        var lapsingRow = await Transfers(f).GetAsync(s.Parish, lapsing.Id, default);
        f.Clock.Now = now.AddDays(2);
        Assert.Equal("Expired", (await Transfers(f).GetAsync(s.Parish, lapsing.Id, default)).Value.Status);
        Assert.Equal("transfer_expired", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).DecideAsync(s.Parish, lapsing.Id,
            new DecidePayerTransferDto { OperationId = Guid.NewGuid(), Version = lapsingRow.Version, Accept = true }, default))).Code);
        f.As(f.Other);
        var next = await Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective), default);
        Assert.Equal("Declined", (await DecideAsync(f, f.FirstAdmin, s.Parish, next.Id, false)).Status);
        f.As(f.Other);
        Assert.Empty((await Transfers(f).ScheduleAsync(s.Parish, default)).Periods);
        Assert.Equal(["Cancelled", "Declined", "Expired"], (await Transfers(f).ListAsync(s.Parish, 25, null, default)).Items.Select(t => t.Status).Order().ToArray());
    }

    [Fact]
    public async Task An_unpaid_invoice_of_the_former_payer_cannot_take_money_after_the_transfer()
    {
        await using var f = await StartAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var effective = f.Clock.Now.AddMonths(1);
        var stale = await s.InvoiceAsync(effective);
        f.As(f.Other);
        var proposed = await Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective), default);
        await DecideAsync(f, f.FirstAdmin, s.Parish, proposed.Id, true);
        Assert.Equal("payer_changed", (await Assert.ThrowsAsync<DomainException>(() => s.PayAsync(s.Parish, stale.Id))).Code);
    }

    [Fact]
    public async Task Only_current_representatives_in_personal_capacity_with_MFA_act_and_strangers_see_nothing()
    {
        await using var f = await StartAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var effective = f.Clock.Now.AddMonths(1);
        var stranger = await f.CreateVerifiedStaffAsync();

        f.As(f.Other, mfa: false);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective), default))).Code);
        f.AsRecovery(f.Other);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective), default))).Code);
        f.AsAppointment(f.Other, Guid.NewGuid().ToString("N"));
        Assert.Equal("personal_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective), default))).Code);
        f.As(stranger);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective), default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ProposeForArchdioceseAsync(s.Archdiocese, s.Parish, Proposal(f, "ToArchdiocese", effective), default))).Kind);

        f.As(f.Other);
        var proposed = await Transfers(f).ProposeForParishAsync(s.Parish, s.Archdiocese, Proposal(f, "ToArchdiocese", effective), default);
        f.As(stranger);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).GetAsync(s.Parish, proposed.Id, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).ScheduleAsync(s.Parish, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, stranger, s.Parish, proposed.Id, true, "any"))).Kind);
        // A sponsoring archdiocese cannot invoice a parish it has never been scheduled to pay for, nor read another account's invoices.
        f.As(f.FirstAdmin);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Transfers(f).CreateSponsoredInvoiceAsync(s.Archdiocese, s.Parish,
            new CreateInvoiceDto { OperationId = Guid.NewGuid(), PlanId = Guid.Parse(s.Plan), StartsAt = effective }, default))).Kind);
    }
}
