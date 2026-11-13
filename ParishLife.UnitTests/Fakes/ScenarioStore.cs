// Purpose: Isolated verification/support for ScenarioStore; fixtures and test-only code are excluded from the API
// deployment.
// Main functions: Row, G, K, Missing, Conflict, Match, Mutate, IsActiveVerifiedAsync, GetGrantAsync,
// RegisterAsync, VerifyAsync, GrantAsync, RevokeAsync, GetCoveragesAsync, ActivateCoverageAsync,
// RegisterArchdioceseAsync, GetArchdioceseAsync, VerifyArchdioceseAsync, ProposeAssociationAsync,
// GetAssociationAsync, DecideAssociationAsync, EndAssociationAsync, PublishAsync, CreateInvoiceAsync,
// GetInvoiceAsync, GetReceiptsAsync, ReceiveCashAsync, GetActivationStatusAsync, FindDueActivationsAsync,
// TryLeaseAsync, CompleteActivationAsync, GetPayerScheduleAsync, ListInvoicesAsync, CreateAsync, UpdateAsync, SetArchiveAsync, GetUtcNow, RequireOperatorAsync.

using ParishLife.Api.Interfaces.Repositories.Billing;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Repositories.People;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Tests.Support;
// A deterministic application-boundary double, NOT a Cosmos emulator. It checks
// service/API contracts without cloud writes; it cannot prove SDK transactions.
public sealed class ScenarioStore(TimeProvider clock) : IParishRepository, IBillingRepository, IPlanRepository, IPeopleRepository, IAccountDirectory
{
    private readonly object gate = new();
    private readonly Dictionary<string, Versioned<Parish>> parishes = [];
    private readonly Dictionary<string, AccessGrant> grants = [];
    private readonly Dictionary<string, Versioned<Archdiocese>> organizations = [];
    private readonly Dictionary<string, Versioned<AssociationRequest>> associations = [];
    private readonly Dictionary<string, PlanDefinition> plans = [];
    private readonly Dictionary<string, Versioned<Invoice>> invoices = [];
    private readonly Dictionary<string, CashReceipt> receipts = [];
    private readonly HashSet<string> receiptReferences = [];
    private readonly Dictionary<string, Versioned<ActivationWork>> work = [];
    private readonly Dictionary<string, Versioned<Person>> people = [];
    private readonly Dictionary<string, (Operation Operation, object Result)> operations = [];
    private int version;
    public HashSet<string> VerifiedAccounts { get; } = [];
    public List<Coverage> Coverages { get; } = [];
    public int PeopleQueries { get; private set; }
    public int ReceiptCount => receipts.Count;
    public int ParishCount => parishes.Count;

    private Versioned<T> Row<T>(T value) => new Versioned<T>
    {
        Value = value,
        Version = (++version).ToString(System.Globalization.CultureInfo.InvariantCulture)
    };
    private static string G(string parishId, AccessGrant grant) => parishId + "|" + grant.AccountId + "|" + (grant.AssociationId ?? "local");
    private static string K(string accountId, string id) => accountId + "|" + id;
    private static DomainException Missing() => new("resource_not_found", "Resource unavailable.", FailureKind.NotFound);
    private static DomainException Conflict() => new("write_conflict", "Version conflict.", FailureKind.Conflict);
    private static void Match<T>(Versioned<T> row, string expected)
    {
        if (row.Version != expected)
            throw Conflict();
    }

    private T Mutate<T>(string partition, Operation op, Func<T> action)
        where T : class
    {
        lock (gate)
        {
            var key = K(partition, op.Id);
            if (operations.TryGetValue(key, out var prior))
            {
                if (prior.Operation.ActorId != op.ActorId || prior.Operation.Fingerprint != op.Fingerprint)
                    throw new DomainException("operation_reused", "Different input for an existing operation.", FailureKind.Conflict);
                return (T)prior.Result;
            }

            var result = action();
            operations.Add(key, (op, result));
            return result;
        }
    }

    public Task<bool> IsActiveVerifiedAsync(string accountId, CancellationToken ct) => Task.FromResult(VerifiedAccounts.Contains(accountId));
    Task<Versioned<Parish>?> IParishRepository.GetAsync(string id, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult(parishes.GetValueOrDefault(id));
    }

    public Task<AccessGrant?> GetGrantAsync(string parishId, string accountId, CancellationToken ct)
    {
        lock (gate)
        {
            if (!parishes.TryGetValue(parishId, out var parish))
                return Task.FromResult<AccessGrant?>(null);
            var now = clock.GetUtcNow();
            var active = grants.Where(p => p.Key.StartsWith(parishId + "|", StringComparison.Ordinal)).Select(p => p.Value).Where(g => g.AccountId == accountId && !g.Revoked && g.StartsAt <= now && (g.EndsAt is null || now < g.EndsAt) && (g.DelegatingOrganizationId is null || (g.DelegatingOrganizationId == parish.Value.RegisteredArchdioceseId && g.AssociationId == parish.Value.RegisteredAssociationId))).ToArray();
            return Task.FromResult(active.Length == 0 ? null : new AccessGrant { AccountId = accountId, Allows = active.SelectMany(g => g.Allows).Distinct().ToArray(), Denies = active.SelectMany(g => g.Denies).Distinct().ToArray(), StartsAt = now, EndsAt = null, Revoked = false, GrantedBy = "effective" });
        }
    }

    public Task<Parish> RegisterAsync(Parish parish, AccessGrant ownerGrant, Operation op, CancellationToken ct) => Task.FromResult(Mutate("tenant:" + parish.Id, op, () =>
    {
        if (parishes.ContainsKey(parish.Id))
            throw Conflict();
        parishes.Add(parish.Id, Row(parish));
        grants.Add(G(parish.Id, ownerGrant), ownerGrant);
        return parish;
    }));
    public Task<Parish> VerifyAsync(string id, string expected, string evidence, Operation op, CancellationToken ct) => Task.FromResult(Mutate("tenant:" + id, op, () =>
    {
        var row = parishes.GetValueOrDefault(id) ?? throw Missing();
        Match(row, expected);
        var verified = row.Value.Verify(evidence);
        parishes[id] = Row(verified);
        return verified;
    }));
    public Task GrantAsync(string id, string expected, AccessGrant grant, Operation op, CancellationToken ct)
    {
        Mutate("tenant:" + id, op, () =>
        {
            var row = parishes.GetValueOrDefault(id) ?? throw Missing();
            Match(row, expected);
            grants[G(id, grant)] = grant;
            parishes[id] = Row(row.Value);
            return grant;
        });
        return Task.CompletedTask;
    }

    public async Task RevokeAsync(string id, string expected, string accountId, string reason, Operation op, CancellationToken ct)
    {
        var grant = await GetGrantAsync(id, accountId, ct) ?? throw Missing();
        Mutate("tenant:" + id, op, () =>
        {
            var row = parishes.GetValueOrDefault(id) ?? throw Missing();
            Match(row, expected);
            foreach (var key in grants.Keys.Where(k => k.StartsWith(id + "|" + accountId + "|", StringComparison.Ordinal)).ToArray())
                grants[key] = new AccessGrant
                {
                    AccountId = grants[key].AccountId,
                    Allows = grants[key].Allows,
                    Denies = grants[key].Denies,
                    StartsAt = grants[key].StartsAt,
                    EndsAt = grants[key].EndsAt,
                    Revoked = true,
                    GrantedBy = grants[key].GrantedBy,
                    DelegatingOrganizationId = grants[key].DelegatingOrganizationId,
                    AssociationId = grants[key].AssociationId
                };
            parishes[id] = Row(row.Value);
            return new AccessGrant
            {
                AccountId = grant.AccountId,
                Allows = grant.Allows,
                Denies = grant.Denies,
                StartsAt = grant.StartsAt,
                EndsAt = grant.EndsAt,
                Revoked = true,
                GrantedBy = grant.GrantedBy,
                DelegatingOrganizationId = grant.DelegatingOrganizationId,
                AssociationId = grant.AssociationId
            };
        });
    }

    // Payer transfers are exercised by the integration tests; this double always has the default self-paying schedule.
    public Task<Versioned<PayerSchedule>?> GetPayerScheduleAsync(string parishId, CancellationToken ct) => Task.FromResult<Versioned<PayerSchedule>?>(null);

    public Task<IReadOnlyList<Invoice>> ListInvoicesAsync(string billingAccountId, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult<IReadOnlyList<Invoice>>(invoices.Values.Select(i => i.Value).Where(i => i.BillingAccountId == billingAccountId).ToArray());
    }

    public Task<IReadOnlyList<Coverage>> GetCoveragesAsync(string id, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult<IReadOnlyList<Coverage>>(Coverages.Where(c => c.ParishId == id).ToArray());
    }

    public Task ActivateCoverageAsync(Coverage coverage, Operation op, CancellationToken ct)
    {
        Mutate("tenant:" + coverage.ParishId, op, () =>
        {
            var row = parishes.GetValueOrDefault(coverage.ParishId) ?? throw Missing();
            if (row.Value.Status != ParishStatus.Verified)
                throw new DomainException("verification_required", "Verification required.", FailureKind.Conflict);
            if (Coverages.Any(c => c.ParishId == coverage.ParishId && c.Overlaps(coverage)))
                throw new DomainException("coverage_overlap", "Coverage overlaps.", FailureKind.Conflict);
            Coverages.Add(coverage);
            parishes[coverage.ParishId] = Row(row.Value);
            return coverage;
        });
        return Task.CompletedTask;
    }

    public Task<Archdiocese> RegisterArchdioceseAsync(Archdiocese organization, Operation op, CancellationToken ct) => Task.FromResult(Mutate("organization:" + organization.Id, op, () =>
    {
        if (organizations.ContainsKey(organization.Id))
            throw Conflict();
        organizations.Add(organization.Id, Row(organization));
        return organization;
    }));
    public Task<Versioned<Archdiocese>?> GetArchdioceseAsync(string id, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult(organizations.GetValueOrDefault(id));
    }

    public Task<Archdiocese> VerifyArchdioceseAsync(string id, string expected, string evidence, Operation op, CancellationToken ct) => Task.FromResult(Mutate("organization:" + id, op, () =>
    {
        var row = organizations.GetValueOrDefault(id) ?? throw Missing();
        Match(row, expected);
        var updated = new Archdiocese
        {
            Id = row.Value.Id,
            Name = row.Value.Name,
            Locality = row.Value.Locality,
            OwnerAccountId = row.Value.OwnerAccountId,
            CreatedAt = row.Value.CreatedAt,
            Verified = true,
            VerificationReference = evidence
        };
        organizations[id] = Row(updated);
        return updated;
    }));
    public Task<AssociationRequest> ProposeAssociationAsync(string parishId, string expected, string orgId, Operation op, CancellationToken ct) => Task.FromResult(Mutate("tenant:" + parishId, op, () =>
    {
        var row = parishes.GetValueOrDefault(parishId) ?? throw Missing();
        Match(row, expected);
        if (row.Value.RegisteredArchdioceseId is not null)
            throw Conflict();
        var proposal = new AssociationRequest
        {
            Id = op.Id,
            ParishId = parishId,
            ArchdioceseId = orgId,
            RequestedBy = op.ActorId,
            RequestedAt = op.At,
            Status = "PendingArchdioceseApproval"
        };
        associations.Add(K(parishId, op.Id), Row(proposal));
        parishes[parishId] = Row(row.Value);
        return proposal;
    }));
    public Task<Versioned<AssociationRequest>?> GetAssociationAsync(string parishId, string requestId, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult(associations.GetValueOrDefault(K(parishId, requestId)));
    }

    public Task<AssociationRequest> DecideAssociationAsync(string parishId, string requestId, string expected, bool accept, Operation op, CancellationToken ct) => Task.FromResult(Mutate("tenant:" + parishId, op, () =>
    {
        var row = associations.GetValueOrDefault(K(parishId, requestId)) ?? throw Missing();
        Match(row, expected);
        var parish = parishes.GetValueOrDefault(parishId) ?? throw Missing();
        if (row.Value.Status != "PendingArchdioceseApproval" || parish.Value.RegisteredArchdioceseId is not null)
            throw Conflict();
        var result = new AssociationRequest
        {
            Id = row.Value.Id,
            ParishId = row.Value.ParishId,
            ArchdioceseId = row.Value.ArchdioceseId,
            RequestedBy = row.Value.RequestedBy,
            RequestedAt = row.Value.RequestedAt,
            Status = accept ? "Accepted" : "Declined",
            DecidedBy = op.ActorId,
            DecidedAt = op.At
        };
        associations[K(parishId, requestId)] = Row(result);
        parishes[parishId] = Row(accept ? new Parish { Id = parish.Value.Id, Name = parish.Value.Name, Locality = parish.Value.Locality, Contact = parish.Value.Contact, DeclaredArchdiocese = parish.Value.DeclaredArchdiocese, Status = parish.Value.Status, OwnerAccountId = parish.Value.OwnerAccountId, CreatedAt = parish.Value.CreatedAt, RegisteredArchdioceseId = row.Value.ArchdioceseId, VerificationReference = parish.Value.VerificationReference, RegisteredAssociationId = requestId, JurisdictionArchdioceseId = parish.Value.JurisdictionArchdioceseId, JurisdictionProposalId = parish.Value.JurisdictionProposalId } : parish.Value);
        return result;
    }));
    public Task<Parish> EndAssociationAsync(string id, string expected, string reason, Operation op, CancellationToken ct) => Task.FromResult(Mutate("tenant:" + id, op, () =>
    {
        var row = parishes.GetValueOrDefault(id) ?? throw Missing();
        Match(row, expected);
        var result = new Parish
        {
            Id = row.Value.Id,
            Name = row.Value.Name,
            Locality = row.Value.Locality,
            Contact = row.Value.Contact,
            DeclaredArchdiocese = row.Value.DeclaredArchdiocese,
            Status = row.Value.Status,
            OwnerAccountId = row.Value.OwnerAccountId,
            CreatedAt = row.Value.CreatedAt,
            RegisteredArchdioceseId = null,
            VerificationReference = row.Value.VerificationReference,
            RegisteredAssociationId = null,
            JurisdictionArchdioceseId = row.Value.JurisdictionArchdioceseId,
            JurisdictionProposalId = row.Value.JurisdictionProposalId
        };
        parishes[id] = Row(result);
        return result;
    }));
    Task<PlanDefinition?> IPlanRepository.GetAsync(string id, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult(plans.GetValueOrDefault(id));
    }

    Task<IReadOnlyList<PlanDefinition>> IPlanRepository.ListAsync(CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult<IReadOnlyList<PlanDefinition>>(plans.Values.ToArray());
    }

    public Task<PlanDefinition> PublishAsync(PlanDefinition plan, Operation op, CancellationToken ct) => Task.FromResult(Mutate("plans", op, () =>
    {
        if (plans.ContainsKey(plan.Id))
            throw Conflict();
        plans.Add(plan.Id, plan);
        return plan;
    }));
    public Task<Invoice> CreateInvoiceAsync(Invoice invoice, Operation op, CancellationToken ct) => Task.FromResult(Mutate("billing:" + invoice.BillingAccountId, op, () =>
    {
        var key = K(invoice.BillingAccountId, invoice.Id);
        if (invoices.ContainsKey(key))
            throw Conflict();
        invoices.Add(key, Row(invoice));
        return invoice;
    }));
    public Task<Versioned<Invoice>?> GetInvoiceAsync(string accountId, string invoiceId, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult(invoices.GetValueOrDefault(K(accountId, invoiceId)));
    }

    public Task<IReadOnlyList<CashReceipt>> GetReceiptsAsync(string accountId, string invoiceId, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult<IReadOnlyList<CashReceipt>>(receipts.Where(r => r.Key.StartsWith(accountId + "|", StringComparison.Ordinal) && r.Value.InvoiceId == invoiceId).Select(r => r.Value).ToArray());
    }

    public Task<CashReceipt> ReceiveCashAsync(string accountId, string invoiceId, string expected, CashReceipt receipt, Operation op, CancellationToken ct) => Task.FromResult(Mutate("billing:" + accountId, op, () =>
    {
        var key = K(accountId, invoiceId);
        var row = invoices.GetValueOrDefault(key) ?? throw Missing();
        Match(row, expected);
        var paid = row.Value.Receive(receipt.Received.Amount, receipt.Received.Currency);
        var reference = K(accountId, receipt.ReceiptReference.Normalize().ToUpperInvariant());
        if (receiptReferences.Contains(reference))
            throw Conflict();
        receiptReferences.Add(reference);
        receipts.Add(K(accountId, receipt.Id), receipt);
        invoices[key] = Row(paid);
        if (paid.Status == "Paid")
            work.Add(key, Row(new ActivationWork { Id = paid.Id, Coverage = new Coverage { Id = paid.Id, ParishId = paid.ParishId, InvoiceId = paid.Id, PlanId = paid.PlanId, Modules = paid.Modules, StartsAt = paid.StartsAt, EndsAt = paid.EndsAt, BillingAccountId = paid.BillingAccountId }, RecordedBy = op.ActorId, CreatedAt = op.At }));
        return receipt;
    }));
    public Task<string> GetActivationStatusAsync(string accountId, string invoiceId, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult(work.GetValueOrDefault(K(accountId, invoiceId))?.Value.Status ?? "AwaitingPayment");
    }

    public Task<IReadOnlyList<Versioned<ActivationWork>>> FindDueActivationsAsync(DateTimeOffset now, CancellationToken ct)
    {
        lock (gate)
            return Task.FromResult<IReadOnlyList<Versioned<ActivationWork>>>(work.Values.Where(w => w.Value.Status == "Pending" || (w.Value.Status == "Processing" && w.Value.LeaseUntil < now)).Take(25).ToArray());
    }

    public Task<Versioned<ActivationWork>?> TryLeaseAsync(Versioned<ActivationWork> candidate, string owner, DateTimeOffset now, CancellationToken ct)
    {
        lock (gate)
        {
            var key = K(candidate.Value.Coverage.BillingAccountId, candidate.Value.Id);
            if (work[key].Version != candidate.Version)
                return Task.FromResult<Versioned<ActivationWork>?>(null);
            var leased = Row(new ActivationWork { Id = candidate.Value.Id, Coverage = candidate.Value.Coverage, RecordedBy = candidate.Value.RecordedBy, CreatedAt = candidate.Value.CreatedAt, Status = "Processing", LeaseOwner = owner, LeaseUntil = now.AddMinutes(2), LastErrorCode = candidate.Value.LastErrorCode });
            work[key] = leased;
            return Task.FromResult<Versioned<ActivationWork>?>(leased);
        }
    }

    public Task CompleteActivationAsync(Versioned<ActivationWork> leased, string status, string? code, CancellationToken ct)
    {
        lock (gate)
        {
            var key = K(leased.Value.Coverage.BillingAccountId, leased.Value.Id);
            Match(work[key], leased.Version);
            work[key] = Row(new ActivationWork { Id = leased.Value.Id, Coverage = leased.Value.Coverage, RecordedBy = leased.Value.RecordedBy, CreatedAt = leased.Value.CreatedAt, Status = status, LeaseOwner = leased.Value.LeaseOwner, LeaseUntil = null, LastErrorCode = code });
            return Task.CompletedTask;
        }
    }

    public Task<Person> CreateAsync(Person person, Operation op, CancellationToken ct) => Task.FromResult(Mutate("tenant:" + person.ParishId, op, () =>
    {
        var key = K(person.ParishId, person.Id);
        if (people.ContainsKey(key))
            throw Conflict();
        people.Add(key, Row(person));
        return person;
    }));
    Task<Versioned<Person>?> IPeopleRepository.GetAsync(string parishId, string id, CancellationToken ct)
    {
        lock (gate)
        {
            PeopleQueries++;
            return Task.FromResult(people.GetValueOrDefault(K(parishId, id)));
        }
    }

    Task<Page<Person>> IPeopleRepository.ListAsync(string parishId, int size, string? token, CancellationToken ct)
    {
        lock (gate)
        {
            PeopleQueries++;
            if (token is not null)
                throw new DomainException("invalid_cursor", "Scenario double does not simulate Cosmos cursors.");
            return Task.FromResult(new Page<Person> { Items = people.Values.Where(p => p.Value.ParishId == parishId).Select(p => p.Value).Take(size).ToArray(), ContinuationToken = null });
        }
    }

    public Task<Person> UpdateAsync(Person person, string expected, Operation op, CancellationToken ct) => Task.FromResult(Mutate("tenant:" + person.ParishId, op, () =>
    {
        var key = K(person.ParishId, person.Id);
        var row = people.GetValueOrDefault(key) ?? throw Missing();
        Match(row, expected);
        people[key] = Row(person);
        return person;
    }));

    public Task<Person> SetArchiveAsync(string parishId, string id, string expected, bool archived, Operation op, CancellationToken ct) => Task.FromResult(Mutate("tenant:" + parishId, op, () =>
    {
        var key = K(parishId, id);
        var row = people.GetValueOrDefault(key) ?? throw Missing();
        Match(row, expected);
        var result = new Person
        {
            Id = row.Value.Id,
            ParishId = row.Value.ParishId,
            GivenName = row.Value.GivenName,
            FamilyName = row.Value.FamilyName,
            GivenNameAr = row.Value.GivenNameAr,
            FamilyNameAr = row.Value.FamilyNameAr,
            BirthDate = row.Value.BirthDate,
            Contact = row.Value.Contact,
            Rite = row.Value.Rite,
            RegisterStatus = row.Value.RegisterStatus,
            CreatedBy = row.Value.CreatedBy,
            CreatedAt = row.Value.CreatedAt,
            UpdatedBy = row.Value.UpdatedBy,
            UpdatedAt = row.Value.UpdatedAt,
            Archived = archived
        };
        people[key] = Row(result);
        return result;
    }));
}

public sealed class ScenarioClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => Now;
}

public sealed class ScenarioActor(string accountId) : ICurrentActor
{
    public string AccountId { get; set; } = accountId;

    public string? ActingAppointmentId { get; set; }
}

public sealed class ScenarioPlatform : IPlatformAccess
{
    public bool Allowed { get; set; }

    public Task RequireOperatorAsync(CancellationToken ct) => Allowed ? Task.CompletedTask : throw new DomainException("operator_required", "Operator required.", FailureKind.Forbidden);
}
