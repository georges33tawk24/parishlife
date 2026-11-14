// Purpose: keeps external renters apart from parish membership and runs each external reservation's rental agreement: a proposed terms
// snapshot, approval by a different finance approver, the renter's recorded acceptance, and actual deposits, fees, refunds, retentions and
// waivers. Deposit received, terms accepted and balance paid stay separate facts; nothing simulates a payment.
// Main functions: CreateRenterAsync, RentersAsync, ProposeAsync, ActAsync and GetAsync.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Finance;

namespace ParishLife.Api.Services.Scheduling;

public class RentalService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static DomainException State(string message) => new("invalid_rental_state", message, FailureKind.Conflict);
    private static DomainException Missing() => new("resource_not_found", "The requested rental record is unavailable.", FailureKind.NotFound);

    private async Task<Versioned<Parish>> RequireAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "facilities", ct);
        return root;
    }

    public async Task<RenterDto> CreateRenterAsync(string parish, SaveRenterDto request, CancellationToken ct)
    {
        var root = await RequireAsync(parish, Permissions.FacilitiesManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "renter:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(SchedulingScope.For(parish), op, ct) is { } prior)
            return Project((await records.ReadAsync<Renter>(SchedulingScope.For(parish), "renter:" + prior.Id, ct))!.Value);
        var item = new Renter
        {
            Id = op.Id, ParishId = parish, Name = Guard.Text(request.Name, "Name", 200),
            NameAr = Optional(request.NameAr, "Arabic name", 200),
            Organization = string.IsNullOrWhiteSpace(request.Organization) ? null : Guard.Text(request.Organization, "Organization", 200),
            OrganizationAr = Optional(request.OrganizationAr, "Arabic organization", 200),
            ResponsibleContact = Guard.Text(request.ResponsibleContact, "Responsible contact", 320),
            VerificationReference = string.IsNullOrWhiteSpace(request.VerificationReference) ? null : Guard.Text(request.VerificationReference, "Verification", 300),
            CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        await records.CommitAsync(SchedulingScope.For(parish), op, "renter.create", item.Id, [SchedulingScope.Fence(root), RecordChange.Create("renter:" + item.Id, "renter", item)],
            new CommandResult { Id = item.Id, Status = "Created" }, ct);
        return Project(item);
    }

    public async Task<IReadOnlyList<RenterDto>> RentersAsync(string parish, CancellationToken ct)
    {
        await RequireAsync(parish, Permissions.FacilitiesManage, ct);
        return (await records.CollectAsync<Renter>(SchedulingScope.For(parish), "renter", ct, 5000)).Select(r => Project(r.Value))
            .OrderBy(r => r.Name, StringComparer.CurrentCultureIgnoreCase).ToArray();
    }

    public async Task<RentalAgreementDto> ProposeAsync(string parish, string reservation, ProposeRentalDto request, CancellationToken ct)
    {
        var root = await RequireAsync(parish, Permissions.FacilitiesManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "rental:v1:" + reservation);
        if (await records.ReplayAsync<CommandResult>(SchedulingScope.For(parish), op, ct) is not null)
            return await GetAsync(parish, reservation, ct);
        var booking = await records.ReadAsync<Reservation>(SchedulingScope.For(parish), "reservation:" + reservation, ct) ?? throw Missing();
        if (booking.Value.Status is "Cancelled" or "Declined")
            throw State("The reservation is no longer active.");
        var renter = Guard.Id(request.RenterId);
        if (await records.ReadAsync<Renter>(SchedulingScope.For(parish), "renter:" + renter, ct) is null)
            throw Missing();
        if (request.Fee < 0 || request.Deposit < 0 || request.Fee + request.Deposit == 0 || decimal.Round(request.Fee, 2) != request.Fee || decimal.Round(request.Deposit, 2) != request.Deposit)
            throw new DomainException("invalid_money", "Use exact fee and deposit amounts with at most two decimals.");
        var key = "rentalAgreement:" + reservation;
        var old = await records.ReadAsync<RentalAgreement>(SchedulingScope.For(parish), key, ct);
        if (old is not null && (old.Value.Status != "Proposed" || old.Value.Payments.Count > 0))
            throw State("These terms are already approved; agree a change with the renter through a new reviewed agreement.");
        var item = new RentalAgreement
        {
            ReservationId = reservation, ParishId = parish, RenterId = renter, Fee = request.Fee, Deposit = request.Deposit, Currency = request.Currency,
            Terms = Guard.Text(request.Terms, "Terms", 4000), ProposedBy = actor.AccountId
        };
        await records.CommitAsync(SchedulingScope.For(parish), op, "rental.propose", reservation,
            [SchedulingScope.Fence(root), old is null ? RecordChange.Create(key, "rentalAgreement", item) : RecordChange.Replace(key, "rentalAgreement", item, old.Version)],
            new CommandResult { Id = reservation, Status = item.Status }, ct);
        return await GetAsync(parish, reservation, ct);
    }

    public async Task<RentalAgreementDto> ActAsync(string parish, string reservation, RentalActionDto request, CancellationToken ct)
    {
        var permission = request.Action switch
        {
            "accept" => Permissions.FacilitiesManage,
            "deposit-received" or "fee-received" => Permissions.FinancePost,
            _ => Permissions.FinanceApprove
        };
        var root = await RequireAsync(parish, permission, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "rental-action:v1:" + reservation);
        if (await records.ReplayAsync<CommandResult>(SchedulingScope.For(parish), op, ct) is not null)
            return await ViewAsync(parish, reservation, ct);
        var key = "rentalAgreement:" + reservation;
        var item = (await records.ReadAsync<RentalAgreement>(SchedulingScope.For(parish), key, ct) ?? throw Missing()).Value;
        var held = Held(item);
        switch (request.Action)
        {
            case "approve" when item.Status == "Proposed":
                if (item.ProposedBy == actor.AccountId)
                    throw State("A finance approver other than the proposer approves the terms.");
                item.Status = "Approved";
                item.ApprovedBy = actor.AccountId;
                break;
            case "accept" when item.Status == "Approved":
                item.Status = "Accepted";
                item.AcceptanceReference = Guard.Text(request.Reference, "Renter acceptance evidence", 300);
                break;
            case "deposit-received" when item.Status == "Accepted" && held + Amount(request) <= item.Deposit:
            case "fee-received" when item.Status == "Accepted" && Amount(request) <= Outstanding(item):
                Pay(item, request.Action == "deposit-received" ? "DepositReceived" : "FeeReceived", request, Guard.Text(request.Reference, "Receipt reference", 300), null);
                break;
            case "refund-deposit" or "retain-deposit" when Amount(request) <= held:
                Pay(item, request.Action == "refund-deposit" ? "DepositRefunded" : "DepositRetained", request, request.Reference, Guard.Text(request.Reason, "Reason", 1000));
                break;
            case "waive-fee" when Amount(request) <= Outstanding(item):
                Pay(item, "FeeWaived", request, null, Guard.Text(request.Reason, "Reason", 1000));
                break;
            default:
                throw State("That step does not fit the agreement's status or amounts.");
        }
        await records.CommitAsync(SchedulingScope.For(parish), op, "rental." + request.Action.Replace('-', '_'), reservation,
            [SchedulingScope.Fence(root), RecordChange.Replace(key, "rentalAgreement", item, Versions.Require(request.Version))],
            new CommandResult { Id = reservation, Status = item.Status }, ct);
        return await ViewAsync(parish, reservation, ct);
    }

    public async Task<RentalAgreementDto> GetAsync(string parish, string reservation, CancellationToken ct)
    {
        await RequireAsync(parish, Permissions.FacilitiesManage, ct);
        return await ViewAsync(parish, reservation, ct);
    }

    private async Task<RentalAgreementDto> ViewAsync(string parish, string reservation, CancellationToken ct)
    {
        var row = await records.ReadAsync<RentalAgreement>(SchedulingScope.For(parish), "rentalAgreement:" + reservation, ct) ?? throw Missing();
        var x = row.Value;
        var held = Held(x);
        var received = x.Payments.Where(p => p.Kind == "DepositReceived").Sum(p => p.Amount);
        return new RentalAgreementDto
        {
            ReservationId = x.ReservationId, Version = row.Version, RenterId = x.RenterId, Fee = x.Fee, Deposit = x.Deposit, Currency = x.Currency, Terms = x.Terms,
            Status = x.Status, ApprovedBy = x.ApprovedBy, AcceptanceReference = x.AcceptanceReference, DepositHeld = held, FeeOutstanding = Outstanding(x),
            DepositState = x.Deposit == 0 ? "NotRequired" : received == 0 ? "Due" : held > 0 ? (received < x.Deposit ? "PartlyReceived" : "Held") : "Settled",
            Payments = [.. x.Payments]
        };
    }

    private void Pay(RentalAgreement item, string kind, RentalActionDto request, string? reference, string? reason)
    {
        var on = request.On ?? DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        if (on > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime))
            throw new DomainException("invalid_input", "Record the actual date; it cannot be in the future.");
        item.Payments.Add(new RentalPayment { Kind = kind, Amount = Amount(request), On = on, Reference = reference, Reason = reason, By = actor.AccountId });
    }

    private static decimal Amount(RentalActionDto request)
    {
        GivingService.Money(request.Amount ?? 0, "XXX");
        return request.Amount!.Value;
    }

    private static decimal Held(RentalAgreement x)
        => x.Payments.Where(p => p.Kind == "DepositReceived").Sum(p => p.Amount) - x.Payments.Where(p => p.Kind is "DepositRefunded" or "DepositRetained").Sum(p => p.Amount);

    private static decimal Outstanding(RentalAgreement x) => x.Fee - x.Payments.Where(p => p.Kind is "FeeReceived" or "FeeWaived").Sum(p => p.Amount);

    private static string? Optional(string? value, string name, int max) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, name, max);

    private static RenterDto Project(Renter x) => new()
    {
        Id = x.Id, Name = x.Name, NameAr = x.NameAr, Organization = x.Organization, OrganizationAr = x.OrganizationAr, ResponsibleContact = x.ResponsibleContact, VerificationReference = x.VerificationReference, CreatedAt = x.CreatedAt
    };
}
