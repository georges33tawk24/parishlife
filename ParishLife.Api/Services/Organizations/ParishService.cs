// Purpose: Handles organization setup, verification, associations, and scoped access independently of subscription
// payer facts.
// Only a ParishLife operator, the bishop or his archdiocese administrators register a church (owner decision, 23 November 2026); one
// registered under an archdiocese is verified and placed under it at once, and its registrar holds only ChurchAdministration until the
// priest takes control (ParishControlService).
// Main functions: RegisterAsync, GetAsync, VerifyAsync, GrantAsync, RevokeAsync,
// RegisterArchdioceseAsync, VerifyArchdioceseAsync, ProposeAssociationAsync, DecideAssociationAsync,
// GetAssociationAsync, GetArchdioceseAsync, InspectVerificationAsync, InspectArchdioceseVerificationAsync,
// EndAssociationAsync.

using ParishLife.Api.Authorization;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Organizations;

public sealed class ParishService(IParishRepository repository, IParishAccess access, ICurrentActor actor, IPlatformAccess platform, IAccountDirectory accounts,
    ChurchAdministrationAuthority church, TimeProvider clock)
{
    public async Task<Parish> RegisterAsync(RegisterParishDto request, CancellationToken ct)
    {
        var archdiocese = request.ArchdioceseId is { } chosen ? Guard.Id(chosen) : null;
        await church.RequireAsync(archdiocese, ct);
        var byOperator = actor.ActingAppointmentId is null && await IsOperatorAsync(ct);
        var op = actor.CreateOperation(request.OperationId, request, clock);
        var parish = new Parish
        {
            Id = op.Id,
            Name = Guard.Text(request.Name, "Name"),
            Locality = Guard.Text(request.Locality, "Locality"),
            Contact = Guard.Text(request.Contact, "Contact", 320),
            DeclaredArchdiocese = string.IsNullOrWhiteSpace(request.DeclaredArchdiocese) ? null : Guard.Text(request.DeclaredArchdiocese, "Declared archdiocese"),
            Status = archdiocese is null ? ParishStatus.PendingVerification : ParishStatus.Verified,
            VerificationReference = archdiocese is null ? null : "Registered under its archdiocese by " + (byOperator ? "a ParishLife operator" : "the archdiocese"),
            JurisdictionArchdioceseId = archdiocese,
            OwnerAccountId = actor.AccountId,
            CreatedAt = op.At
        };
        var owner = new AccessGrant
        {
            AccountId = actor.AccountId,
            Allows = (byOperator ? Permissions.SetupOwner : Permissions.ChurchAdministration).Order().ToArray(),
            Denies = [],
            StartsAt = op.At,
            EndsAt = null,
            Revoked = false,
            GrantedBy = actor.AccountId
        };
        return await repository.RegisterAsync(parish, owner, op, ct);
    }

    // The account by reference, or by username or email.
    private async Task<string> TargetAsync(Guid id, string? name, CancellationToken ct)
    {
        if (id != Guid.Empty)
            return Guard.Id(id);
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("invalid_input", "Name the account by its username or email.");
        return await accounts.FindIdAsync(Guard.Text(name, "Account", 254), ct)
            ?? throw new DomainException("account_unavailable", "No active verified account has that username or email.");
    }

    private async Task<bool> IsOperatorAsync(CancellationToken ct)
    {
        try { await platform.RequireOperatorAsync(ct); return true; }
        catch (DomainException e) when (e.Kind is FailureKind.Forbidden or FailureKind.NotFound) { return false; }
    }

    public Task<Versioned<Parish>> GetAsync(string id, CancellationToken ct) => access.RequireAsync(id, Permissions.BillingRead, ct);
    public async Task<Parish> VerifyAsync(string id, VerifyParishDto request, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        return await repository.VerifyAsync(id, Versions.Require(request.Version), Guard.Text(request.EvidenceReference, "Evidence", 500), actor.CreateOperation(request.OperationId, request, clock), ct);
    }

    public async Task GrantAsync(string id, GrantAccessDto request, CancellationToken ct)
    {
        var parish = await access.RequireAsync(id, Permissions.AccessManage, ct);
        if (actor.AccountId != parish.Value.OwnerAccountId)
            throw new DomainException("owner_authority_required", "The controlling parish owner manages grants in this implementation stage.", FailureKind.Forbidden);
        if (request.Allows is null || request.Denies is null || request.Allows.Length + request.Denies.Length > Permissions.All.Count * 2 || request.Allows.Concat(request.Denies).Any(p => !Permissions.All.Contains(p)) || request.Allows.Distinct().Count() != request.Allows.Length || request.Denies.Distinct().Count() != request.Denies.Length)
            throw new DomainException("invalid_permissions", "Specify distinct supported permissions.");
        if (request.Allows.Contains(Permissions.AccessManage, StringComparer.Ordinal))
            throw new DomainException("grant_administration_not_delegable", "Grant administration requires the separate bounded authority/succession workflow.");
        var mine = await repository.GetGrantAsync(id, actor.AccountId, ct);
        if (request.Allows.Concat(request.Denies).Any(p => mine?.Permits(p, clock.GetUtcNow()) != true))
            throw new DomainException("delegation_forbidden", "Cannot delegate authority outside your current grant.", FailureKind.Forbidden);
        var target = await TargetAsync(request.AccountId, request.Account, ct);
        if (!await accounts.IsActiveVerifiedAsync(target, ct))
            throw new DomainException("account_unavailable", "The target must be an existing active verified account.");
        if (target == parish.Value.OwnerAccountId)
            throw new DomainException("owner_change_requires_review", "Changing the controlling owner's access requires the separate recovery/succession procedure.", FailureKind.Conflict);
        Guard.Utc(request.StartsAt);
        if (request.EndsAt is { } end && (Guard.Utc(end) <= request.StartsAt || end <= clock.GetUtcNow()))
            throw new DomainException("invalid_dates", "Grant end must follow its start and the current time.");
        if (request.DelegatingOrganizationId is { } org && Guard.Id(org) != parish.Value.RegisteredArchdioceseId)
            throw new DomainException("association_required", "The named archdiocese is not associated with this parish.", FailureKind.Conflict);
        await repository.GrantAsync(id, Versions.Require(request.Version), new AccessGrant { AccountId = target, Allows = request.Allows, Denies = request.Denies, StartsAt = request.StartsAt, EndsAt = request.EndsAt, Revoked = false, GrantedBy = actor.AccountId, DelegatingOrganizationId = request.DelegatingOrganizationId?.ToString("N"), AssociationId = request.DelegatingOrganizationId is null ? null : parish.Value.RegisteredAssociationId }, actor.CreateOperation(request.OperationId, request, clock), ct);
    }

    public async Task RevokeAsync(string id, RevokeAccessDto request, CancellationToken ct)
    {
        var parish = await access.RequireAsync(id, Permissions.AccessManage, ct);
        if (actor.AccountId != parish.Value.OwnerAccountId)
            throw new DomainException("owner_authority_required", "The controlling parish owner manages grants in this implementation stage.", FailureKind.Forbidden);
        var target = await TargetAsync(request.AccountId, request.Account, ct);
        if (target == parish.Value.OwnerAccountId)
            throw new DomainException("owner_change_requires_review", "Use the separate controlling-owner recovery/succession procedure.", FailureKind.Conflict);
        await repository.RevokeAsync(id, Versions.Require(request.Version), target, Guard.Text(request.Reason, "Reason", 500), actor.CreateOperation(request.OperationId, request, clock), ct);
    }

    public async Task<Archdiocese> RegisterArchdioceseAsync(RegisterArchdioceseDto request, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        var op = actor.CreateOperation(request.OperationId, request, clock);
        return await repository.RegisterArchdioceseAsync(new Archdiocese { Id = op.Id, Name = Guard.Text(request.Name, "Name"), Locality = Guard.Text(request.Locality, "Locality"), OwnerAccountId = actor.AccountId, CreatedAt = op.At }, op, ct);
    }

    public async Task<Archdiocese> VerifyArchdioceseAsync(string id, VerifyParishDto request, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        return await repository.VerifyArchdioceseAsync(id, Versions.Require(request.Version), Guard.Text(request.EvidenceReference, "Evidence", 500), actor.CreateOperation(request.OperationId, request, clock), ct);
    }

    public async Task<AssociationRequest> ProposeAssociationAsync(string id, AssociationProposalDto request, CancellationToken ct)
    {
        var parish = await access.RequireAsync(id, Permissions.ParishManage, ct);
        if (parish.Value.Status != ParishStatus.Verified)
            throw new DomainException("verification_required", "Verify the parish representative before organizational association.", FailureKind.Conflict);
        var orgId = Guard.Id(request.ArchdioceseId);
        if ((await repository.GetArchdioceseAsync(orgId, ct))?.Value.Verified != true)
            throw new DomainException("organization_unavailable", "A verified registered archdiocese is required for this optional association.");
        return await repository.ProposeAssociationAsync(id, Versions.Require(request.Version), orgId, actor.CreateOperation(request.OperationId, request, clock), ct);
    }

    public async Task<AssociationRequest> DecideAssociationAsync(string id, string requestId, AssociationDecisionDto request, CancellationToken ct)
    {
        RequirePersonalCapacity();
        var association = await repository.GetAssociationAsync(id, requestId, ct);
        var org = association is null ? null : await repository.GetArchdioceseAsync(association.Value.ArchdioceseId, ct);
        if (org?.Value.Verified != true || org.Value.OwnerAccountId != actor.AccountId)
            throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        return await repository.DecideAssociationAsync(id, requestId, Versions.Require(request.Version), request.Accept, actor.CreateOperation(request.OperationId, request, clock, "association:" + requestId), ct);
    }

    public async Task<Versioned<AssociationRequest>> GetAssociationAsync(string id, string requestId, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
            await access.RequireAsync(id, Permissions.ParishManage, ct);
        var association = await repository.GetAssociationAsync(id, requestId, ct);
        if (association is null)
            throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        var grant = await repository.GetGrantAsync(id, actor.AccountId, ct);
        if (grant?.Permits(Permissions.ParishManage, clock.GetUtcNow()) != true)
        {
            var org = await repository.GetArchdioceseAsync(association.Value.ArchdioceseId, ct);
            if (org?.Value.OwnerAccountId != actor.AccountId)
                throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        }

        return association;
    }

    public async Task<Versioned<Archdiocese>> GetArchdioceseAsync(string id, CancellationToken ct)
    {
        RequirePersonalCapacity();
        var org = await repository.GetArchdioceseAsync(id, ct);
        if (org?.Value.OwnerAccountId != actor.AccountId)
            throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
        return org;
    }

    public async Task<Versioned<Parish>> InspectVerificationAsync(string id, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        return await repository.GetAsync(id, ct) ?? throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
    }

    public async Task<Versioned<Archdiocese>> InspectArchdioceseVerificationAsync(string id, CancellationToken ct)
    {
        await platform.RequireOperatorAsync(ct);
        return await repository.GetArchdioceseAsync(id, ct) ?? throw new DomainException("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
    }

    public async Task<Parish> EndAssociationAsync(string id, EndAssociationDto request, CancellationToken ct)
    {
        await access.RequireAsync(id, Permissions.ParishManage, ct);
        return await repository.EndAssociationAsync(id, Versions.Require(request.Version), Guard.Text(request.Reason, "Reason", 500), actor.CreateOperation(request.OperationId, request, clock), ct);
    }

    private void RequirePersonalCapacity()
    {
        if (actor.ActingAppointmentId is not null)
            throw new DomainException("personal_capacity_required", "Clear the appointment selection for this personal representative action.", FailureKind.Forbidden);
    }
}
