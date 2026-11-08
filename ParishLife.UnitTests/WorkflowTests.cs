// Purpose: Isolated verification/support for WorkflowTests; fixtures and test-only code are excluded from the API
// deployment.
// Main functions: Parish, Invoice, Cash, Activate, Independent_registration_does_not_create_archdiocese_or_people,
// Parish_customer_cannot_self_confirm_cash_or_publish_prices,
// Fully_paid_cash_invoice_activates_office_without_archdiocese, Partial_cash_does_not_enable_paid_features,
// Retrying_cash_after_a_lost_response_does_not_receive_twice, Invalid_cash_never_changes_invoice,
// Other_tenant_access_is_rejected_before_people_query, Parish_verification_is_not_self_approval,
// Association_gives_no_private_access_and_ending_it_invalidates_its_delegation,
// Cannot_pregrant_access_to_an_unregistered_account_id,
// Delegates_cannot_create_a_permanent_grant_administration_escape,
// A_second_paid_overlapping_period_requires_review_not_double_coverage,
// People_are_parish_owned_and_archive_rejects_stale_edits,
// Expired_or_denied_permission_cannot_be_used_by_changing_context.

using ParishLife.Api.Authorization;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Billing;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Tests.Support;
using Xunit;

namespace ParishLife.UnitTests;

public sealed class WorkflowTests
{
    private sealed class Fixture
    {
        internal readonly ScenarioClock Clock = new();
        internal readonly ScenarioActor Actor = new(Guid.NewGuid().ToString("N"));
        internal readonly ScenarioPlatform Platform = new();
        internal readonly ScenarioStore Store;
        internal readonly ParishService Parishes;
        internal readonly BillingService Billing;
        internal readonly PeopleService People;
        internal readonly ParishAccess Access;
        internal Fixture()
        {
            Store = new(Clock);
            Store.VerifiedAccounts.Add(Actor.AccountId);
            Access = new(Store, Actor, Clock, new LegacyOnlyStaffAccess());
            Parishes = new(Store, Access, Actor, Platform, Store, Clock);
            Billing = new(Store, Store, Store, Access, Actor, Platform, Clock);
            People = new(Store, Access, Actor, Clock);
        }

        internal async Task<string> Parish(bool verified = true)
        {
            var parish = await Parishes.RegisterAsync(new Api.DTOs.Organizations.RegisterParishDto { OperationId = Guid.NewGuid(), Name = "Independent parish", Locality = "Beirut", Contact = "Office contact", DeclaredArchdiocese = "An unregistered archdiocese" }, default);
            if (verified)
            {
                Platform.Allowed = true;
                var current = await Parishes.GetAsync(parish.Id, default);
                await Parishes.VerifyAsync(parish.Id, new Api.DTOs.Organizations.VerifyParishDto { OperationId = Guid.NewGuid(), Version = current.Version, EvidenceReference = "reviewed evidence" }, default);
                Platform.Allowed = false;
            }

            return parish.Id;
        }

        internal async Task<Invoice> Invoice(string parishId)
        {
            Platform.Allowed = true;
            var plan = await Billing.PublishPlanAsync(new PublishPlanDto { OperationId = Guid.NewGuid(), Name = "Office annual", Amount = 100m, Currency = "USD", MinorUnits = 2, TermMonths = 12, Modules = ["core", "office"] }, default);
            Platform.Allowed = false;
            return await Billing.CreateInvoiceAsync(parishId, new CreateInvoiceDto { OperationId = Guid.NewGuid(), PlanId = Guid.Parse(plan.Id), StartsAt = Clock.Now }, default);
        }

        internal async Task<RecordCashDto> Cash(string parishId, Invoice invoice, decimal amount = 100m, string currency = "USD")
        {
            var summary = await Billing.GetAsync(parishId, invoice.Id, default);
            return new RecordCashDto
            {
                OperationId = Guid.NewGuid(),
                Version = summary.Invoice.Version,
                Amount = amount,
                Currency = currency,
                ReceivedAt = Clock.Now,
                PayerName = "Parish representative",
                CollectedBy = "Collector",
                ReceiptReference = Guid.NewGuid().ToString("N")
            };
        }

        internal async Task Activate(string parishId)
        {
            var invoice = await Invoice(parishId);
            var cash = await Cash(parishId, invoice);
            Platform.Allowed = true;
            await Billing.RecordCashAsync(parishId, invoice.Id, cash, default);
            Platform.Allowed = false;
            await new CoverageActivationProcessor(Store, Store, Clock).ProcessAsync("worker", default);
        }
    }

    [Fact]
    public async Task Independent_registration_does_not_create_archdiocese_or_people()
    {
        var f = new Fixture();
        var id = await f.Parish(false);
        var parish = await f.Parishes.GetAsync(id, default);
        Assert.Null(parish.Value.RegisteredArchdioceseId);
        Assert.Equal("An unregistered archdiocese", parish.Value.DeclaredArchdiocese);
        Assert.Equal(1, f.Store.ParishCount);
        Assert.Equal(0, f.Store.PeopleQueries);
    }

    [Fact]
    public async Task Parish_customer_cannot_self_confirm_cash_or_publish_prices()
    {
        var f = new Fixture();
        var id = await f.Parish();
        var invoice = await f.Invoice(id);
        var cash = await f.Cash(id, invoice);
        Assert.Equal("operator_required", (await Assert.ThrowsAsync<DomainException>(() => f.Billing.RecordCashAsync(id, invoice.Id, cash, default))).Code);
        Assert.Equal(0, f.Store.ReceiptCount);
        Assert.Equal("operator_required", (await Assert.ThrowsAsync<DomainException>(() => f.Billing.PublishPlanAsync(new PublishPlanDto { OperationId = Guid.NewGuid(), Name = "Own free plan", Amount = 1, Currency = "USD", MinorUnits = 2, TermMonths = 12, Modules = ["core"] }, default))).Code);
    }

    [Fact]
    public async Task Fully_paid_cash_invoice_activates_office_without_archdiocese()
    {
        var f = new Fixture();
        var id = await f.Parish();
        var invoice = await f.Invoice(id);
        var cash = await f.Cash(id, invoice);
        f.Platform.Allowed = true;
        await f.Billing.RecordCashAsync(id, invoice.Id, cash, default);
        f.Platform.Allowed = false;
        Assert.Equal("Pending", (await f.Billing.GetAsync(id, invoice.Id, default)).ActivationStatus);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => f.People.ListAsync(id, 50, null, default))).Code);
        var processor = new CoverageActivationProcessor(f.Store, f.Store, f.Clock);
        Assert.Equal(1, await processor.ProcessAsync("one", default));
        Assert.Equal(0, await processor.ProcessAsync("two", default));
        Assert.Single(f.Store.Coverages);
        Assert.Null((await f.Parishes.GetAsync(id, default)).Value.RegisteredArchdioceseId);
        Assert.Empty((await f.People.ListAsync(id, 50, null, default)).Items);
    }

    [Fact]
    public async Task Partial_cash_does_not_enable_paid_features()
    {
        var f = new Fixture();
        var id = await f.Parish();
        var invoice = await f.Invoice(id);
        var cash = await f.Cash(id, invoice, 40m);
        f.Platform.Allowed = true;
        await f.Billing.RecordCashAsync(id, invoice.Id, cash, default);
        f.Platform.Allowed = false;
        var summary = await f.Billing.GetAsync(id, invoice.Id, default);
        Assert.Equal("PartiallyPaid", summary.Invoice.Value.Status);
        Assert.Equal(40m, summary.Invoice.Value.Paid);
        Assert.Equal(0, await new CoverageActivationProcessor(f.Store, f.Store, f.Clock).ProcessAsync("worker", default));
        Assert.Empty(f.Store.Coverages);
    }

    [Fact]
    public async Task Retrying_cash_after_a_lost_response_does_not_receive_twice()
    {
        var f = new Fixture();
        var id = await f.Parish();
        var invoice = await f.Invoice(id);
        var cash = await f.Cash(id, invoice);
        f.Platform.Allowed = true;
        var first = await f.Billing.RecordCashAsync(id, invoice.Id, cash, default);
        var replay = await f.Billing.RecordCashAsync(id, invoice.Id, cash, default);
        Assert.Equal(first, replay);
        Assert.Equal(1, f.Store.ReceiptCount);
        Assert.Equal("operation_reused", (await Assert.ThrowsAsync<DomainException>(() => f.Billing.RecordCashAsync(id, invoice.Id, new RecordCashDto { OperationId = cash.OperationId, Version = cash.Version, Amount = 1, Currency = cash.Currency, ReceivedAt = cash.ReceivedAt, PayerName = cash.PayerName, CollectedBy = cash.CollectedBy, ReceiptReference = cash.ReceiptReference }, default))).Code);
    }

    [Theory]
    [InlineData(101, "USD", "overpayment")]
    [InlineData(100, "LBP", "currency_mismatch")]
    [InlineData(0, "USD", "invalid_money")]
    public async Task Invalid_cash_never_changes_invoice(decimal amount, string currency, string code)
    {
        var f = new Fixture();
        var id = await f.Parish();
        var invoice = await f.Invoice(id);
        var cash = await f.Cash(id, invoice, amount, currency);
        f.Platform.Allowed = true;
        Assert.Equal(code, (await Assert.ThrowsAsync<DomainException>(() => f.Billing.RecordCashAsync(id, invoice.Id, cash, default))).Code);
        f.Platform.Allowed = false;
        Assert.Equal(0, f.Store.ReceiptCount);
        Assert.Equal(0m, (await f.Billing.GetAsync(id, invoice.Id, default)).Invoice.Value.Paid);
    }

    [Fact]
    public async Task Other_tenant_access_is_rejected_before_people_query()
    {
        var f = new Fixture();
        var id = await f.Parish();
        await f.Activate(id);
        f.Actor.AccountId = Guid.NewGuid().ToString("N");
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => f.People.ListAsync(id, 50, null, default))).Kind);
        Assert.Equal(0, f.Store.PeopleQueries);
    }

    [Fact]
    public async Task Parish_verification_is_not_self_approval()
    {
        var f = new Fixture();
        var id = await f.Parish(false);
        var current = await f.Parishes.GetAsync(id, default);
        Assert.Equal("operator_required", (await Assert.ThrowsAsync<DomainException>(() => f.Parishes.VerifyAsync(id, new Api.DTOs.Organizations.VerifyParishDto { OperationId = Guid.NewGuid(), Version = current.Version, EvidenceReference = "self" }, default))).Code);
    }

    [Fact]
    public async Task Association_gives_no_private_access_and_ending_it_invalidates_its_delegation()
    {
        var f = new Fixture();
        var id = await f.Parish();
        await f.Activate(id);
        var owner = f.Actor.AccountId;
        var archOwner = Guid.NewGuid().ToString("N");
        f.Store.VerifiedAccounts.Add(archOwner);
        f.Actor.AccountId = archOwner;
        f.Platform.Allowed = true;
        var arch = await f.Parishes.RegisterArchdioceseAsync(new Api.DTOs.Organizations.RegisterArchdioceseDto { OperationId = Guid.NewGuid(), Name = "Archdiocese", Locality = "Beirut" }, default);
        f.Platform.Allowed = true;
        var archState = await f.Parishes.GetArchdioceseAsync(arch.Id, default);
        await f.Parishes.VerifyArchdioceseAsync(arch.Id, new Api.DTOs.Organizations.VerifyParishDto { OperationId = Guid.NewGuid(), Version = archState.Version, EvidenceReference = "reviewed" }, default);
        f.Platform.Allowed = false;
        f.Actor.AccountId = owner;
        var parish = await f.Parishes.GetAsync(id, default);
        var proposal = await f.Parishes.ProposeAssociationAsync(id, new Api.DTOs.Organizations.AssociationProposalDto { OperationId = Guid.NewGuid(), Version = parish.Version, ArchdioceseId = Guid.Parse(arch.Id) }, default);
        f.Actor.AccountId = archOwner;
        var review = await f.Parishes.GetAssociationAsync(id, proposal.Id, default);
        await f.Parishes.DecideAssociationAsync(id, proposal.Id, new Api.DTOs.Organizations.AssociationDecisionDto { OperationId = Guid.NewGuid(), Version = review.Version, Accept = true }, default);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => f.People.ListAsync(id, 50, null, default))).Kind);
        f.Actor.AccountId = owner;
        parish = await f.Parishes.GetAsync(id, default);
        await f.Parishes.GrantAsync(id, new Api.DTOs.Organizations.GrantAccessDto { OperationId = Guid.NewGuid(), Version = parish.Version, AccountId = Guid.Parse(archOwner), Allows = [Permissions.BillingRead], Denies = [], StartsAt = f.Clock.Now, EndsAt = null }, default);
        parish = await f.Parishes.GetAsync(id, default);
        await f.Parishes.GrantAsync(id, new Api.DTOs.Organizations.GrantAccessDto { OperationId = Guid.NewGuid(), Version = parish.Version, AccountId = Guid.Parse(archOwner), Allows = [Permissions.PeopleRead], Denies = [], StartsAt = f.Clock.Now, EndsAt = null, DelegatingOrganizationId = Guid.Parse(arch.Id) }, default);
        f.Actor.AccountId = archOwner;
        Assert.Empty((await f.People.ListAsync(id, 50, null, default)).Items);
        f.Actor.AccountId = owner;
        parish = await f.Parishes.GetAsync(id, default);
        await f.Parishes.EndAssociationAsync(id, new Api.DTOs.Organizations.EndAssociationDto { OperationId = Guid.NewGuid(), Version = parish.Version, Reason = "Parish withdraws delegation" }, default);
        f.Actor.AccountId = archOwner;
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => f.People.ListAsync(id, 50, null, default))).Kind);
        Assert.Null((await f.Access.RequireAsync(id, Permissions.BillingRead, default)).Value.RegisteredArchdioceseId);
        Assert.Single(f.Store.Coverages);
        Assert.Equal(1, f.Store.ReceiptCount);
    }

    [Fact]
    public async Task Cannot_pregrant_access_to_an_unregistered_account_id()
    {
        var f = new Fixture();
        var id = await f.Parish();
        var parish = await f.Parishes.GetAsync(id, default);
        var error = await Assert.ThrowsAsync<DomainException>(() => f.Parishes.GrantAsync(id, new Api.DTOs.Organizations.GrantAccessDto { OperationId = Guid.NewGuid(), Version = parish.Version, AccountId = Guid.NewGuid(), Allows = [Permissions.PeopleRead], Denies = [], StartsAt = f.Clock.Now, EndsAt = null }, default));
        Assert.Equal("account_unavailable", error.Code);
    }

    [Fact]
    public async Task Delegates_cannot_create_a_permanent_grant_administration_escape()
    {
        var f = new Fixture();
        var id = await f.Parish();
        var parish = await f.Parishes.GetAsync(id, default);
        var target = Guid.NewGuid();
        f.Store.VerifiedAccounts.Add(target.ToString("N"));
        var error = await Assert.ThrowsAsync<DomainException>(() => f.Parishes.GrantAsync(id, new Api.DTOs.Organizations.GrantAccessDto { OperationId = Guid.NewGuid(), Version = parish.Version, AccountId = target, Allows = [Permissions.AccessManage], Denies = [], StartsAt = f.Clock.Now, EndsAt = null }, default));
        Assert.Equal("grant_administration_not_delegable", error.Code);
    }

    [Fact]
    public async Task A_second_paid_overlapping_period_requires_review_not_double_coverage()
    {
        var f = new Fixture();
        var id = await f.Parish();
        await f.Activate(id);
        var invoice = await f.Invoice(id);
        var cash = await f.Cash(id, invoice);
        f.Platform.Allowed = true;
        await f.Billing.RecordCashAsync(id, invoice.Id, cash, default);
        f.Platform.Allowed = false;
        await new CoverageActivationProcessor(f.Store, f.Store, f.Clock).ProcessAsync("worker", default);
        Assert.Equal("NeedsReview", (await f.Billing.GetAsync(id, invoice.Id, default)).ActivationStatus);
        Assert.Single(f.Store.Coverages);
    }

    [Fact]
    public async Task People_are_parish_owned_and_archive_rejects_stale_edits()
    {
        var f = new Fixture();
        var id = await f.Parish();
        await f.Activate(id);
        var person = await f.People.CreateAsync(id, new Api.DTOs.People.CreatePersonDto { OperationId = Guid.NewGuid(), GivenName = "Marie", FamilyName = "Example", BirthDate = null, Contact = null }, default);
        var initial = await f.People.GetAsync(id, person.Id, default);
        await f.People.SetArchiveAsync(id, person.Id, new Api.DTOs.People.ArchivePersonDto { OperationId = Guid.NewGuid(), Version = initial.Version, Archived = true }, default);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => f.People.SetArchiveAsync(id, person.Id, new Api.DTOs.People.ArchivePersonDto { OperationId = Guid.NewGuid(), Version = initial.Version, Archived = false }, default))).Code);
        Assert.True((await f.People.GetAsync(id, person.Id, default)).Value.Archived);
    }

    [Fact]
    public void Expired_or_denied_permission_cannot_be_used_by_changing_context()
    {
        var now = new ScenarioClock().Now;
        var grant = new AccessGrant
        {
            AccountId = "account",
            Allows = [Permissions.PeopleRead],
            Denies = [Permissions.PeopleRead],
            StartsAt = now,
            EndsAt = null,
            Revoked = false,
            GrantedBy = "owner"
        };
        Assert.False(grant.Permits(Permissions.PeopleRead, now));
        Assert.False((new AccessGrant { AccountId = grant.AccountId, Allows = grant.Allows, Denies = [], StartsAt = grant.StartsAt, EndsAt = now, Revoked = grant.Revoked, GrantedBy = grant.GrantedBy, DelegatingOrganizationId = grant.DelegatingOrganizationId, AssociationId = grant.AssociationId }).Permits(Permissions.PeopleRead, now));
        Assert.False((new AccessGrant { AccountId = grant.AccountId, Allows = grant.Allows, Denies = [], StartsAt = grant.StartsAt, EndsAt = grant.EndsAt, Revoked = true, GrantedBy = grant.GrantedBy, DelegatingOrganizationId = grant.DelegatingOrganizationId, AssociationId = grant.AssociationId }).Permits(Permissions.PeopleRead, now));
    }
}
