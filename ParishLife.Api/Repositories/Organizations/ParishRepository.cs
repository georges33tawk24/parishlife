// Purpose: Persists organization verification, scoped grants, associations, and coverage with
// conditional/idempotent writes.
// Main functions: P, A, GetAsync, GrantId, GetGrantAsync, RegisterAsync, VerifyAsync, GrantAsync, RevokeAsync,
// GetCoveragesAsync, ActivateCoverageAsync, GetArchdioceseAsync, RegisterArchdioceseAsync, VerifyArchdioceseAsync,
// ProposeAssociationAsync, GetAssociationAsync, DecideAssociationAsync, EndAssociationAsync, CommitOrReplay,
// Missing.

using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using static ParishLife.Api.Data.Cosmos.JsonDefaults;

namespace ParishLife.Api.Repositories.Organizations;

internal sealed class ParishRepository(PartitionDocuments documents, TimeProvider clock) : IParishRepository
{
    private const string C = Containers.TenantControl;
    private static string P(string id) => "parish:" + id;
    private static string A(string id) => "archdiocese:" + id;
    public Task<Versioned<Parish>?> GetAsync(string parishId, CancellationToken ct) => documents.ReadAsync<Parish>(C, P(parishId), "parish", ct);
    private static string GrantId(AccessGrant grant) => "grant:" + grant.AccountId + ":" + (grant.AssociationId ?? "local");
    public async Task<AccessGrant?> GetGrantAsync(string parishId, string accountId, CancellationToken ct)
    {
        var parish = await GetAsync(parishId, ct);
        if (parish is null)
            return null;
        var grants = await documents.QueryAsync<AccessGrant>(C, P(parishId), StorageQuery.Type("grant").Where(StorageFilter.And(StorageFilter.Eq("data.accountId", accountId), StorageFilter.Eq("data.revoked", false), StorageFilter.Or(StorageFilter.Eq("data.delegatingOrganizationId", null), StorageFilter.And(StorageFilter.Eq("data.delegatingOrganizationId", parish.Value.RegisteredArchdioceseId), StorageFilter.Eq("data.associationId", parish.Value.RegisteredAssociationId))))), ct);
        var now = clock.GetUtcNow();
        var active = grants.Where(g => !g.Revoked && g.StartsAt <= now && (g.EndsAt is null || now < g.EndsAt)).ToArray();
        if (active.Length == 0)
            return null;
        return new AccessGrant
        {
            AccountId = accountId,
            Allows = active.SelectMany(g => g.Allows).Distinct().ToArray(),
            Denies = active.SelectMany(g => g.Denies).Distinct().ToArray(),
            StartsAt = now,
            EndsAt = active.Where(g => g.EndsAt.HasValue).Select(g => g.EndsAt).DefaultIfEmpty(null).Min(),
            Revoked = false,
            GrantedBy = "effective-grants"
        };
    }

    public async Task<Parish> RegisterAsync(Parish parish, AccessGrant ownerGrant, Operation operation, CancellationToken ct)
    {
        var key = P(parish.Id);
        if (await documents.ReplayAsync<Parish>(C, key, operation, ct) is { } prior)
            return prior;
        var batch = documents.Batch(C, key).CreateItem(Row("parish", key, "parish", parish)).CreateItem(Row(GrantId(ownerGrant), key, "grant", ownerGrant)).CreateItem(Receipt(key, operation, parish)).CreateItem(Audit(key, operation, "parish.register_independent", parish.Id));
        return await CommitOrReplay(batch, key, operation, parish, ct);
    }

    public async Task<Parish> VerifyAsync(string parishId, string version, string evidence, Operation operation, CancellationToken ct)
    {
        var key = P(parishId);
        if (await documents.ReplayAsync<Parish>(C, key, operation, ct) is { } prior)
            return prior;
        var parish = await GetAsync(parishId, ct) ?? throw Missing();
        var verified = parish.Value.Verify(evidence);
        return await CommitOrReplay(documents.Batch(C, key).ReplaceItem("parish", Row("parish", key, "parish", verified), PartitionDocuments.Match(version)).CreateItem(Receipt(key, operation, verified)).CreateItem(Audit(key, operation, "parish.verify_representative", parishId, evidence)), key, operation, verified, ct);
    }

    public async Task GrantAsync(string parishId, string version, AccessGrant grant, Operation operation, CancellationToken ct)
    {
        var key = P(parishId);
        if (await documents.ReplayAsync<AccessGrant>(C, key, operation, ct) is not null)
            return;
        var parish = await GetAsync(parishId, ct) ?? throw Missing();
        var batch = documents.Batch(C, key).ReplaceItem("parish", Row("parish", key, "parish", parish.Value), PartitionDocuments.Match(version)).UpsertItem(Row(GrantId(grant), key, "grant", grant)).CreateItem(Receipt(key, operation, grant)).CreateItem(Audit(key, operation, "access.grant", grant.AccountId));
        await CommitOrReplay(batch, key, operation, grant, ct);
    }

    public async Task RevokeAsync(string parishId, string version, string accountId, string reason, Operation operation, CancellationToken ct)
    {
        var key = P(parishId);
        if (await documents.ReplayAsync<AccessGrant>(C, key, operation, ct) is not null)
            return;
        var parish = await GetAsync(parishId, ct) ?? throw Missing();
        var grants = await documents.QueryAsync<AccessGrant>(C, key, StorageQuery.Type("grant").Where(StorageFilter.And(StorageFilter.Eq("data.accountId", accountId), StorageFilter.Eq("data.revoked", false))), ct, 90);
        var effective = await GetGrantAsync(parishId, accountId, ct) ?? throw Missing();
        var revoked = new AccessGrant
        {
            AccountId = effective.AccountId,
            Allows = effective.Allows,
            Denies = effective.Denies,
            StartsAt = effective.StartsAt,
            EndsAt = effective.EndsAt,
            Revoked = true,
            GrantedBy = effective.GrantedBy,
            DelegatingOrganizationId = effective.DelegatingOrganizationId,
            AssociationId = effective.AssociationId
        };
        var batch = documents.Batch(C, key).ReplaceItem("parish", Row("parish", key, "parish", parish.Value), PartitionDocuments.Match(version)).CreateItem(Receipt(key, operation, revoked)).CreateItem(Audit(key, operation, "access.revoke", accountId, reason));
        foreach (var grant in grants)
            batch.UpsertItem(Row(GrantId(grant), key, "grant", new AccessGrant { AccountId = grant.AccountId, Allows = grant.Allows, Denies = grant.Denies, StartsAt = grant.StartsAt, EndsAt = grant.EndsAt, Revoked = true, GrantedBy = grant.GrantedBy, DelegatingOrganizationId = grant.DelegatingOrganizationId, AssociationId = grant.AssociationId }));
        await CommitOrReplay(batch, key, operation, revoked, ct);
    }

    public Task<IReadOnlyList<Coverage>> GetCoveragesAsync(string parishId, CancellationToken ct) => documents.QueryAsync<Coverage>(C, P(parishId), StorageQuery.Type("coverage"), ct);
    public async Task ActivateCoverageAsync(Coverage coverage, Operation operation, CancellationToken ct)
    {
        var key = P(coverage.ParishId);
        if (await documents.ReplayAsync<Coverage>(C, key, operation, ct) is not null)
            return;
        var parish = await GetAsync(coverage.ParishId, ct) ?? throw Missing();
        if (parish.Value.Status != ParishStatus.Verified)
            throw new DomainException("verification_required", "Coverage requires an open verified parish.", FailureKind.Conflict);
        if ((await GetCoveragesAsync(coverage.ParishId, ct)).Any(c => c.Overlaps(coverage)))
            throw new DomainException("coverage_overlap", "Another base subscription already covers part of this period. Billing review is required.", FailureKind.Conflict);
        // The parish document is a shared revision guard for EVERY coverage writer.
        // Concurrent activation sees a changed ETag and cannot oversubscribe a period.
        await CommitOrReplay(documents.Batch(C, key).ReplaceItem("parish", Row("parish", key, "parish", parish.Value), PartitionDocuments.Match(parish.Version)).CreateItem(Row("coverage:" + coverage.Id, key, "coverage", coverage)).CreateItem(Receipt(key, operation, coverage)).CreateItem(Audit(key, operation, "subscription.activate_paid", coverage.InvoiceId)), key, operation, coverage, ct);
    }

    public Task<Versioned<Archdiocese>?> GetArchdioceseAsync(string id, CancellationToken ct) => documents.ReadAsync<Archdiocese>(C, A(id), "organization", ct);
    public async Task<Archdiocese> RegisterArchdioceseAsync(Archdiocese organization, Operation operation, CancellationToken ct)
    {
        var key = A(organization.Id);
        if (await documents.ReplayAsync<Archdiocese>(C, key, operation, ct) is { } prior)
            return prior;
        return await CommitOrReplay(documents.Batch(C, key).CreateItem(Row("organization", key, "organization", organization)).CreateItem(Receipt(key, operation, organization)).CreateItem(Audit(key, operation, "archdiocese.register", organization.Id)), key, operation, organization, ct);
    }

    public async Task<Archdiocese> VerifyArchdioceseAsync(string id, string version, string evidence, Operation operation, CancellationToken ct)
    {
        var key = A(id);
        if (await documents.ReplayAsync<Archdiocese>(C, key, operation, ct) is { } prior)
            return prior;
        var organization = await GetArchdioceseAsync(id, ct) ?? throw Missing();
        if (organization.Value.Verified)
            throw new DomainException("invalid_state", "The organization is already verified.", FailureKind.Conflict);
        var verified = new Archdiocese
        {
            Id = organization.Value.Id,
            Name = organization.Value.Name,
            Locality = organization.Value.Locality,
            OwnerAccountId = organization.Value.OwnerAccountId,
            CreatedAt = organization.Value.CreatedAt,
            Verified = true,
            VerificationReference = evidence
        };
        return await CommitOrReplay(documents.Batch(C, key).ReplaceItem("organization", Row("organization", key, "organization", verified), PartitionDocuments.Match(version)).CreateItem(Receipt(key, operation, verified)).CreateItem(Audit(key, operation, "archdiocese.verify", id, evidence)), key, operation, verified, ct);
    }

    public async Task<AssociationRequest> ProposeAssociationAsync(string parishId, string version, string archdioceseId, Operation operation, CancellationToken ct)
    {
        var key = P(parishId);
        if (await documents.ReplayAsync<AssociationRequest>(C, key, operation, ct) is { } prior)
            return prior;
        var parish = await GetAsync(parishId, ct) ?? throw Missing();
        if (parish.Value.RegisteredArchdioceseId is not null)
            throw new DomainException("already_associated", "End/review the current association before proposing another.", FailureKind.Conflict);
        var proposal = new AssociationRequest
        {
            Id = operation.Id,
            ParishId = parishId,
            ArchdioceseId = archdioceseId,
            RequestedBy = operation.ActorId,
            RequestedAt = operation.At,
            Status = "PendingArchdioceseApproval"
        };
        return await CommitOrReplay(documents.Batch(C, key).ReplaceItem("parish", Row("parish", key, "parish", parish.Value), PartitionDocuments.Match(version)).CreateItem(Row("association:" + proposal.Id, key, "association", proposal)).CreateItem(Receipt(key, operation, proposal)).CreateItem(Audit(key, operation, "association.parish_approved", proposal.Id)), key, operation, proposal, ct);
    }

    public Task<Versioned<AssociationRequest>?> GetAssociationAsync(string parishId, string requestId, CancellationToken ct) => documents.ReadAsync<AssociationRequest>(C, P(parishId), "association:" + requestId, ct);
    public async Task<AssociationRequest> DecideAssociationAsync(string parishId, string requestId, string version, bool accept, Operation operation, CancellationToken ct)
    {
        var key = P(parishId);
        if (await documents.ReplayAsync<AssociationRequest>(C, key, operation, ct) is { } prior)
            return prior;
        var current = await GetAssociationAsync(parishId, requestId, ct) ?? throw Missing();
        var parish = await GetAsync(parishId, ct) ?? throw Missing();
        if (current.Value.Status != "PendingArchdioceseApproval" || parish.Value.RegisteredArchdioceseId is not null)
            throw new DomainException("invalid_association_state", "This association is no longer awaiting this decision.", FailureKind.Conflict);
        var decided = new AssociationRequest
        {
            Id = current.Value.Id,
            ParishId = current.Value.ParishId,
            ArchdioceseId = current.Value.ArchdioceseId,
            RequestedBy = current.Value.RequestedBy,
            RequestedAt = current.Value.RequestedAt,
            Status = accept ? "Accepted" : "Declined",
            DecidedBy = operation.ActorId,
            DecidedAt = operation.At
        };
        var updatedParish = accept ? new Parish
        {
            Id = parish.Value.Id,
            Name = parish.Value.Name,
            Locality = parish.Value.Locality,
            Contact = parish.Value.Contact,
            DeclaredArchdiocese = parish.Value.DeclaredArchdiocese,
            Status = parish.Value.Status,
            OwnerAccountId = parish.Value.OwnerAccountId,
            CreatedAt = parish.Value.CreatedAt,
            RegisteredArchdioceseId = current.Value.ArchdioceseId,
            VerificationReference = parish.Value.VerificationReference,
            RegisteredAssociationId = requestId,
            JurisdictionArchdioceseId = parish.Value.JurisdictionArchdioceseId,
            JurisdictionProposalId = parish.Value.JurisdictionProposalId
        }

        : parish.Value;
        // Deliberately no access grant and no billing change in this batch.
        return await CommitOrReplay(documents.Batch(C, key).ReplaceItem("parish", Row("parish", key, "parish", updatedParish), PartitionDocuments.Match(parish.Version)).ReplaceItem("association:" + requestId, Row("association:" + requestId, key, "association", decided), PartitionDocuments.Match(version)).CreateItem(Receipt(key, operation, decided)).CreateItem(Audit(key, operation, "association.decide", requestId)), key, operation, decided, ct);
    }

    public async Task<Parish> EndAssociationAsync(string parishId, string version, string reason, Operation operation, CancellationToken ct)
    {
        var key = P(parishId);
        if (await documents.ReplayAsync<Parish>(C, key, operation, ct) is { } prior)
            return prior;
        var parish = await GetAsync(parishId, ct) ?? throw Missing();
        if (parish.Value.RegisteredArchdioceseId is null)
            throw new DomainException("no_association", "This parish has no active registered association.", FailureKind.Conflict);
        var ended = new Parish
        {
            Id = parish.Value.Id,
            Name = parish.Value.Name,
            Locality = parish.Value.Locality,
            Contact = parish.Value.Contact,
            DeclaredArchdiocese = parish.Value.DeclaredArchdiocese,
            Status = parish.Value.Status,
            OwnerAccountId = parish.Value.OwnerAccountId,
            CreatedAt = parish.Value.CreatedAt,
            RegisteredArchdioceseId = null,
            VerificationReference = parish.Value.VerificationReference,
            RegisteredAssociationId = null,
            JurisdictionArchdioceseId = parish.Value.JurisdictionArchdioceseId,
            JurisdictionProposalId = parish.Value.JurisdictionProposalId
        };
        // Changing the association epoch invalidates all of its delegated grants
        // immediately, without an unbounded cross-document revocation fan-out.
        return await CommitOrReplay(documents.Batch(C, key).ReplaceItem("parish", Row("parish", key, "parish", ended), PartitionDocuments.Match(version)).CreateItem(Receipt(key, operation, ended)).CreateItem(Audit(key, operation, "association.end", parishId, reason)), key, operation, ended, ct);
    }

    private async Task<T> CommitOrReplay<T>(DocumentBatch batch, string key, Operation op, T result, CancellationToken ct)
        where T : class
    {
        try
        {
            await documents.CommitAsync(batch, ct);
            return result;
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            var replay = await documents.ReplayAsync<T>(C, key, op, ct);
            if (replay is not null)
                return replay;
            throw;
        }
    }

    private static DomainException Missing() => new("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
}
