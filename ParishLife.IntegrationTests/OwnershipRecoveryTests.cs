// Purpose: verifies contested parish ownership review and administration recovery (SUB12) through real local services, Identity and storage.
// Main tests: recovery moves only control while records, staff grants, coverage and history stay and no clergy authority appears; stale or
// competing claims cannot install a second owner; rejection and withdrawal expose nothing; role-limited views; party, MFA and capacity refusals;
// the archdiocese bishop must confirm before recovery and the parish is read-only while any claim is open (owner decision, 23 November 2026).

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Billing;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class OwnershipRecoveryTests
{
    private static OwnershipRecoveryService Claims(LocalBackendFixture f) => f.Services.GetRequiredService<OwnershipRecoveryService>();
    private static IParishAccess Access(LocalBackendFixture f) => f.Services.GetRequiredService<IParishAccess>();

    private static OpenOwnershipClaimDto Open() => new() { OperationId = Guid.NewGuid(), Statement = "I am the appointed parish administrator.", EvidenceReference = "isolated claim evidence" };

    private static async Task<OwnershipClaimDto> DecideAsync(LocalBackendFixture f, string parish, string id, bool recover, string? reviewer = null, string? version = null)
    {
        f.As(reviewer ?? f.SecondAdmin);
        var row = await Claims(f).GetAsync(parish, id, default);
        return await Claims(f).DecideAsync(parish, id, new DecideOwnershipClaimDto
        {
            OperationId = Guid.NewGuid(), Version = version ?? row.Version, Recover = recover, Reason = "Isolated recovery review", EvidenceReference = "isolated reviewed documents"
        }, default);
    }

    // Places the independent parish under an archdiocese whose bishop (the fixture Nominee) can confirm ownership claims.
    private static async Task UnderBishopAsync(LocalBackendFixture f, IndependentParishScenario s)
    {
        var archdiocese = await f.AppointedOrganizationAsync();
        var jurisdiction = f.Services.GetRequiredService<ParishJurisdictionService>();
        f.As(f.Other);
        var proposal = await jurisdiction.ProposeAsync(s.Parish, new ProposeParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Parishes.GetAsync(s.Parish, default))!.Version, ArchdioceseId = Guid.Parse(archdiocese),
            Reason = "Isolated first jurisdiction", EvidenceReference = "isolated factual jurisdiction evidence"
        }, default);
        f.As(f.Nominee);
        var row = await jurisdiction.GetAsync(s.Parish, proposal.Id, default);
        await jurisdiction.DecideAsync(s.Parish, proposal.Id, new DecideParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, Accept = true, Reason = "Isolated bishop decision",
            CurrentPassword = "isolated-fixture-long-password", CurrentCode = RealIdentityWorkflowTests.FixtureCode()
        }, default);
    }

    private static async Task<OwnershipClaimDto> ConfirmAsync(LocalBackendFixture f, string parish, string id, bool confirmed = true)
    {
        f.As(f.Nominee);
        var row = await Claims(f).GetAsync(parish, id, default);
        return await Claims(f).ConfirmAsync(parish, id, new ConfirmOwnershipClaimDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, Confirmed = confirmed, Note = "Isolated archdiocese answer"
        }, default);
    }

    private static async Task<bool> ContestedAsync(IndependentParishScenario s) => (await s.Parishes.GetAsync(s.Parish, default))!.Value.OwnershipContested;

    private static async Task<LocalBackendFixture> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        return f;
    }

    [Fact]
    public async Task Recovery_moves_only_control_and_preserves_records_grants_coverage_and_history()
    {
        await using var f = await StartAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var invoice = await s.InvoiceAsync(f.Clock.Now);
        await s.PayAsync(s.Parish, invoice.Id);
        Assert.Equal(1, await s.ActivateAsync());
        var staff = await f.CreateVerifiedStaffAsync();
        var claimant = await f.CreateVerifiedStaffAsync();
        await UnderBishopAsync(f, s);
        f.As(f.Other);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Parishes.GetAsync(s.Parish, default))!.Version, AccountId = Guid.Parse(staff),
            Allows = [Permissions.PeopleRead], Denies = [], StartsAt = f.Clock.Now
        }, default);
        var transfer = await f.Services.GetRequiredService<PayerTransferService>().ProposeForParishAsync(s.Parish, s.Archdiocese, new ProposePayerTransferDto
        {
            OperationId = Guid.NewGuid(), Direction = "ToArchdiocese", EffectiveFrom = f.Clock.Now.AddMonths(2), AcceptBy = f.Clock.Now.AddDays(7), Reason = "Pending under old control"
        }, default);

        f.As(claimant);
        var request = Open();
        var claim = await Claims(f).OpenAsync(s.Parish, request, default);
        Assert.Equal(("Open", claimant), (claim.Status, claim.ClaimantAccountId));
        Assert.True(await ContestedAsync(s));
        Assert.Equal(claim.Id, (await Claims(f).OpenAsync(s.Parish, request, default)).Id);
        Assert.Equal("claim_already_open", (await Assert.ThrowsAsync<DomainException>(() => Claims(f).OpenAsync(s.Parish, Open(), default))).Code);
        // Opening a claim grants the claimant nothing.
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Access(f).RequireAsync(s.Parish, Permissions.PeopleRead, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Claims(f).ListAsync(s.Parish, 25, null, default))).Kind);

        // The owner is told in-app that a review exists and sees no claimant identity, statement or evidence.
        f.As(f.Other);
        // While contested the parish stays readable but refuses every change, including the owner's.
        await Access(f).RequireAsync(s.Parish, Permissions.BillingRead, default);
        Assert.Equal("parish_contested", (await Assert.ThrowsAsync<DomainException>(() => Access(f).RequireAsync(s.Parish, Permissions.PeopleWrite, default))).Code);
        Assert.Contains((await f.Services.GetRequiredService<NotificationService>().ListAsync(null, 25, null, default)).Items, n => n.Topic == "parish.ownership_claim");
        var ownerView = (await Claims(f).ListAsync(s.Parish, 25, null, default)).Items.Single();
        Assert.Equal(("Open", (string?)null, (string?)null, (string?)null), (ownerView.Status, ownerView.ClaimantAccountId, ownerView.Statement, ownerView.EvidenceReference));
        var row = await Claims(f).GetAsync(s.Parish, claim.Id, default);
        await Claims(f).RespondAsync(s.Parish, claim.Id, new RespondOwnershipClaimDto { OperationId = Guid.NewGuid(), Version = row.Version, Response = "Please contact me first." }, default);

        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, s.Parish, claim.Id, true, version: row.Version))).Code);
        // Recovery waits for the archdiocese; the bishop sees the full claim.
        Assert.Equal("church_confirmation_required", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, s.Parish, claim.Id, true))).Code);
        var confirmed = await ConfirmAsync(f, s.Parish, claim.Id);
        Assert.Equal(("Confirmed", f.Nominee, "isolated claim evidence"), (confirmed.ChurchConfirmation, confirmed.ChurchConfirmedBy, confirmed.EvidenceReference));
        f.As(f.SecondAdmin);
        var decision = new DecideOwnershipClaimDto
        {
            OperationId = Guid.NewGuid(), Version = (await Claims(f).GetAsync(s.Parish, claim.Id, default)).Version, Recover = true,
            Reason = "Isolated recovery review", EvidenceReference = "isolated reviewed documents"
        };
        var recovered = await Claims(f).DecideAsync(s.Parish, claim.Id, decision, default);
        Assert.Equal("Recovered", (await Claims(f).DecideAsync(s.Parish, claim.Id, decision, default)).Status);
        Assert.Equal(("Recovered", f.Other, "Please contact me first."), (recovered.Status, recovered.PreviousOwnerAccountId, recovered.OwnerResponse));
        Assert.Contains("grant:" + f.Other + ":local revoked", recovered.ReconciledRecords);
        Assert.Contains("payerTransfer:" + transfer.Id + " cancelled", recovered.ReconciledRecords);
        Assert.Equal(claimant, (await s.Parishes.GetAsync(s.Parish, default))!.Value.OwnerAccountId);
        Assert.False(await ContestedAsync(s));

        // Control moved; the prior owner's access ended; staff grants, coverage, invoices and the claim history stay.
        f.As(f.Other);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Access(f).RequireAsync(s.Parish, Permissions.BillingRead, default))).Kind);
        f.As(staff);
        await Access(f).RequireAsync(s.Parish, Permissions.PeopleRead, default);
        f.As(claimant);
        await Access(f).RequireAsync(s.Parish, Permissions.PeopleWrite, default);
        Assert.Single(await s.Billing.GetCoverageAsync(s.Parish, default));
        Assert.Equal("Paid", (await s.Billing.GetAsync(s.Parish, invoice.Id, default)).Invoice.Value.Status);
        Assert.Equal("Cancelled", (await f.Services.GetRequiredService<PayerTransferService>().GetAsync(s.Parish, transfer.Id, default)).Value.Status);
        // Administration recovery is not clergy office or signing authority.
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Access(f).RequireAsync(s.Parish, Permissions.ClergyApprove, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Access(f).RequireAsync(s.Parish, Permissions.DocumentsSign, default))).Kind);
        Assert.Equal("Recovered", (await Claims(f).GetAsync(s.Parish, claim.Id, default)).Value.Status);
    }

    [Fact]
    public async Task Competing_claims_cannot_install_a_second_owner_and_rejected_or_withdrawn_claims_expose_nothing()
    {
        await using var f = await StartAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var second = await f.CreateVerifiedStaffAsync();
        var claimant = await f.CreateVerifiedStaffAsync();
        await UnderBishopAsync(f, s);
        f.As(claimant);
        var first = await Claims(f).OpenAsync(s.Parish, Open(), default);
        f.As(second);
        var competing = await Claims(f).OpenAsync(s.Parish, Open(), default);
        // The claimant's own view never includes the owner's response or reviewer evidence.
        Assert.Null((await Claims(f).GetAsync(s.Parish, competing.Id, default)).Value.OwnerAtOpening);

        await ConfirmAsync(f, s.Parish, first.Id);
        await ConfirmAsync(f, s.Parish, competing.Id);
        Assert.Equal("Recovered", (await DecideAsync(f, s.Parish, first.Id, true)).Status);
        // The competing claim is still open, so the parish stays read-only until it ends.
        Assert.True(await ContestedAsync(s));
        Assert.Equal("owner_changed", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, s.Parish, competing.Id, true))).Code);
        Assert.Equal("Rejected", (await DecideAsync(f, s.Parish, competing.Id, false)).Status);
        Assert.False(await ContestedAsync(s));
        Assert.Equal(claimant, (await s.Parishes.GetAsync(s.Parish, default))!.Value.OwnerAccountId);
        f.As(second);
        Assert.Equal("Rejected", (await Claims(f).GetAsync(s.Parish, competing.Id, default)).Value.Status);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Access(f).RequireAsync(s.Parish, Permissions.PeopleRead, default))).Kind);

        // Withdrawal closes the claim and lets the claimant open a fresh one later.
        var again = await Claims(f).OpenAsync(s.Parish, Open(), default);
        var row = await Claims(f).GetAsync(s.Parish, again.Id, default);
        Assert.True(await ContestedAsync(s));
        Assert.Equal("Withdrawn", (await Claims(f).WithdrawAsync(s.Parish, again.Id, new WithdrawOwnershipClaimDto { OperationId = Guid.NewGuid(), Version = row.Version }, default)).Status);
        Assert.False(await ContestedAsync(s));
        Assert.Equal("invalid_claim_state", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, s.Parish, again.Id, true))).Code);
        f.As(second);
        await Claims(f).OpenAsync(s.Parish, Open(), default);
    }

    [Fact]
    public async Task Parties_strangers_recovery_sessions_and_selected_capacities_cannot_act()
    {
        await using var f = await StartAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var stranger = await f.CreateVerifiedStaffAsync();

        f.AsRecovery(f.Nominee);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => Claims(f).OpenAsync(s.Parish, Open(), default))).Code);
        f.AsAppointment(f.Nominee, Guid.NewGuid().ToString("N"));
        Assert.Equal("personal_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => Claims(f).OpenAsync(s.Parish, Open(), default))).Code);
        f.As(f.Other);
        Assert.Equal("invalid_claim_state", (await Assert.ThrowsAsync<DomainException>(() => Claims(f).OpenAsync(s.Parish, Open(), default))).Code);
        f.As(f.Nominee);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Claims(f).OpenAsync(Guid.NewGuid().ToString("N"), Open(), default))).Kind);

        // A platform operator who is the claimant cannot decide their own claim; the claimant or a stranger is no reviewer.
        f.As(f.FirstAdmin);
        var operatorClaim = await Claims(f).OpenAsync(s.Parish, Open(), default);
        Assert.Equal("independent_review_required", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, s.Parish, operatorClaim.Id, true, f.FirstAdmin))).Code);
        f.As(f.Nominee);
        var claim = await Claims(f).OpenAsync(s.Parish, Open(), default);
        Assert.Equal("operator_required", (await Assert.ThrowsAsync<DomainException>(() => Claims(f).DecideAsync(s.Parish, claim.Id,
            new DecideOwnershipClaimDto { OperationId = Guid.NewGuid(), Version = "any", Recover = true, Reason = "Self", EvidenceReference = "none" }, default))).Code);
        f.As(stranger);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Claims(f).GetAsync(s.Parish, claim.Id, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Claims(f).WithdrawAsync(s.Parish, claim.Id,
            new WithdrawOwnershipClaimDto { OperationId = Guid.NewGuid(), Version = "any" }, default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => Claims(f).RespondAsync(s.Parish, claim.Id,
            new RespondOwnershipClaimDto { OperationId = Guid.NewGuid(), Version = "any", Response = "Not mine" }, default))).Kind);
        f.As(f.SecondAdmin);
        var review = (await Claims(f).GetAsync(s.Parish, claim.Id, default)).Value;
        Assert.Equal(("isolated claim evidence", f.Other), (review.EvidenceReference, review.OwnerAtOpening));
        // A parish with no confirmed archdiocese has no church to confirm, so it cannot be recovered; rejection still works.
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => ConfirmAsync(f, s.Parish, claim.Id))).Kind);
        Assert.Equal("church_confirmation_required", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, s.Parish, claim.Id, true))).Code);
        Assert.Equal("Rejected", (await DecideAsync(f, s.Parish, claim.Id, false)).Status);
    }

    [Fact]
    public async Task Only_an_independent_archdiocese_bishop_confirms_and_a_disputed_claim_cannot_recover()
    {
        await using var f = await StartAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var claimant = await f.CreateVerifiedStaffAsync();
        var stranger = await f.CreateVerifiedStaffAsync();
        await UnderBishopAsync(f, s);
        f.As(claimant);
        var claim = await Claims(f).OpenAsync(s.Parish, Open(), default);

        // Strangers, the claimant and the owner are not the church.
        foreach (var account in new[] { stranger, claimant, f.Other })
        {
            f.As(account);
            await Assert.ThrowsAsync<DomainException>(() => Claims(f).ConfirmAsync(s.Parish, claim.Id,
                new ConfirmOwnershipClaimDto { OperationId = Guid.NewGuid(), Version = "any", Confirmed = true, Note = "Not the bishop" }, default));
        }

        Assert.Equal("Disputed", (await ConfirmAsync(f, s.Parish, claim.Id, false)).ChurchConfirmation);
        Assert.Equal("church_confirmation_required", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(f, s.Parish, claim.Id, true))).Code);
        // A later answer replaces the earlier one while the claim is open.
        Assert.Equal("Confirmed", (await ConfirmAsync(f, s.Parish, claim.Id)).ChurchConfirmation);

        // The bishop cannot confirm a claim they made themselves.
        f.As(f.Nominee);
        var own = await Claims(f).OpenAsync(s.Parish, Open(), default);
        Assert.Equal("independent_review_required", (await Assert.ThrowsAsync<DomainException>(() => ConfirmAsync(f, s.Parish, own.Id))).Code);

        Assert.Equal("Recovered", (await DecideAsync(f, s.Parish, claim.Id, true)).Status);
        // The bishop's own claim is still open, so the parish stays read-only for the new owner too.
        f.As(claimant);
        Assert.Equal("parish_contested", (await Assert.ThrowsAsync<DomainException>(() => Access(f).RequireAsync(s.Parish, Permissions.PeopleWrite, default))).Code);
    }
}
