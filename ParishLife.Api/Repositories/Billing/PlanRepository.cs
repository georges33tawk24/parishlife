// Purpose: Reads/publishes versioned plan terms through Cosmos while retaining operation and audit history.
// Main functions: GetAsync, ListAsync, PublishAsync, Replay, CheckVersion.

using Microsoft.EntityFrameworkCore;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Billing;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Repositories.Billing;

internal sealed class PlanRepository(PlanDbContext database) : IPlanRepository
{
    public async Task<PlanDefinition?> GetAsync(string id, CancellationToken ct)
    {
        var document = await database.Plans.AsNoTracking().SingleOrDefaultAsync(p => p.PartitionKey == "plans" && p.Id == id, ct);
        if (document is not null)
            CheckVersion(document);
        return document?.Plan;
    }

    public async Task<IReadOnlyList<PlanDefinition>> ListAsync(CancellationToken ct)
    {
        var plans = await database.Plans.AsNoTracking().Where(p => p.PartitionKey == "plans").Take(101).ToListAsync(ct);
        if (plans.Count > 100)
            throw new DomainException("catalog_limit", "Plan catalogue requires versioned retirement before further publication.", FailureKind.Conflict);
        foreach (var plan in plans)
            CheckVersion(plan);
        return plans.Select(p => p.Plan).OrderBy(p => p.Name, StringComparer.Ordinal).ToArray();
    }

    public async Task<PlanDefinition> PublishAsync(PlanDefinition plan, Operation operation, CancellationToken ct)
    {
        var existing = await database.Plans.AsNoTracking().SingleOrDefaultAsync(p => p.PartitionKey == "plans" && p.Id == plan.Id, ct);
        if (existing is not null)
            return Replay(existing, operation);
        database.Plans.Add(new() { Id = plan.Id, Plan = plan, Fingerprint = operation.Fingerprint, PublishedBy = operation.ActorId });
        try
        {
            await database.SaveChangesAsync(ct);
            return plan;
        }
        catch (DbUpdateException)
        {
            database.ChangeTracker.Clear();
            existing = await database.Plans.AsNoTracking().SingleOrDefaultAsync(p => p.PartitionKey == "plans" && p.Id == plan.Id, ct);
            if (existing is not null)
                return Replay(existing, operation);
            throw;
        }
    }

    private static PlanDefinition Replay(PlanDocument document, Operation operation)
    {
        if (document.Fingerprint != operation.Fingerprint || document.PublishedBy != operation.ActorId)
            throw new DomainException("operation_reused", "This plan ID already belongs to another publication operation.", FailureKind.Conflict);
        CheckVersion(document);
        return document.Plan;
    }

    private static void CheckVersion(PlanDocument document)
    {
        if (document.SchemaVersion != 1 || document.Type != "plan")
            throw new DomainException("unsupported_document_version", "A plan data upgrade is required.", FailureKind.Unavailable);
    }
}
