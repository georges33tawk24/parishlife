// Purpose: verifies external renters and rental agreements (F07) through real local services and storage.
// Main tests: a terms snapshot approved by a different finance approver and accepted by the renter; deposits and fees recorded only as
// actual payments within the agreed amounts; separate deposit and balance states; reasoned refunds, retentions and waivers.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RentalTests
{
    [Fact]
    public async Task Rentals_snapshot_approved_terms_and_record_only_actual_money_within_them()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(f);
        var facility = await s.FacilityAsync();
        var booking = await s.RequestAsync(await s.EventAsync(), facility.Id);
        var approver = await GrantAsync(s, [Permissions.FinanceApprove]);
        var cashier = await GrantAsync(s, [Permissions.FinancePost]);
        var rentals = f.Services.GetRequiredService<RentalService>();

        s.Use();
        var renter = await rentals.CreateRenterAsync(s.Parish, new SaveRenterDto { OperationId = Guid.NewGuid(), Name = "Isolated choir society", ResponsibleContact = "choir@fixture.example" }, default);
        var proposed = await rentals.ProposeAsync(s.Parish, booking.Id, new ProposeRentalDto
        {
            OperationId = Guid.NewGuid(), RenterId = Guid.Parse(renter.Id), Fee = 200m, Deposit = 100m, Currency = "USD", Terms = "Isolated hall terms v1: cancellation 7 days"
        }, default);
        Assert.Equal(("Proposed", "Due", 200m), (proposed.Status, proposed.DepositState, proposed.FeeOutstanding));

        f.As(approver);
        proposed = await ActAsync(rentals, s.Parish, booking.Id, proposed.Version, "approve");
        s.Use();
        var accepted = await ActAsync(rentals, s.Parish, booking.Id, proposed.Version, "accept", reference: "Signed terms form 12");
        await Assert.ThrowsAsync<DomainException>(() => rentals.ProposeAsync(s.Parish, booking.Id, new ProposeRentalDto
        {
            OperationId = Guid.NewGuid(), RenterId = Guid.Parse(renter.Id), Fee = 150m, Deposit = 0m, Currency = "USD", Terms = "Changed rate"
        }, default));

        f.As(cashier);
        Assert.Equal("invalid_rental_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(rentals, s.Parish, booking.Id, accepted.Version, "deposit-received", 150m, "R-1"))).Code);
        var deposit = await ActAsync(rentals, s.Parish, booking.Id, accepted.Version, "deposit-received", 100m, "R-1");
        Assert.Equal(("Held", 100m, 200m), (deposit.DepositState, deposit.DepositHeld, deposit.FeeOutstanding));
        var fee = await ActAsync(rentals, s.Parish, booking.Id, deposit.Version, "fee-received", 150m, "R-2");

        f.As(approver);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(rentals, s.Parish, booking.Id, fee.Version, "waive-fee", 50m))).Code);
        var waived = await ActAsync(rentals, s.Parish, booking.Id, fee.Version, "waive-fee", 50m, reason: "Parish charity rate approved by the priest");
        var retained = await ActAsync(rentals, s.Parish, booking.Id, waived.Version, "retain-deposit", 30m, reason: "Broken chair");
        var settled = await ActAsync(rentals, s.Parish, booking.Id, retained.Version, "refund-deposit", 70m, "Refund 9", "Hall returned clean otherwise");
        Assert.Equal(("Settled", 0m, 0m, 5), (settled.DepositState, settled.DepositHeld, settled.FeeOutstanding, settled.Payments.Length));
    }

    private static async Task<string> GrantAsync(SchedulingScenario s, string[] allows)
    {
        var account = await s.Fixture.CreateVerifiedStaffAsync();
        s.Fixture.As(s.Fixture.FirstAdmin);
        await s.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Staff.Parishes.GetAsync(s.Parish, default))!.Version, AccountId = Guid.Parse(account), Allows = allows, StartsAt = s.Fixture.Clock.Now
        }, default);
        return account;
    }

    private static Task<RentalAgreementDto> ActAsync(RentalService rentals, string parish, string reservation, string version, string action, decimal? amount = null,
        string? reference = null, string? reason = null)
        => rentals.ActAsync(parish, reservation, new RentalActionDto { OperationId = Guid.NewGuid(), Version = version, Action = action, Amount = amount, Reference = reference, Reason = reason }, default);
}
