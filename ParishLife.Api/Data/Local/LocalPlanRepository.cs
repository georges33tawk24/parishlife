// Purpose: Stores immutable plan versions in the isolated Development provider; never used by production
// configuration.
// Main functions: GetAsync, ListAsync, PublishAsync.

using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Billing;
using ParishLife.Api.Models;
using static ParishLife.Api.Data.Cosmos.JsonDefaults;

namespace ParishLife.Api.Data.Local;

internal sealed class LocalPlanRepository(PartitionDocuments documents) : IPlanRepository
{
    public async Task<PlanDefinition?> GetAsync(string id, CancellationToken ct) => (await documents.ReadAsync<PlanDefinition>(Containers.Catalog, "plans", "plan:" + id, ct))?.Value;
    public Task<IReadOnlyList<PlanDefinition>> ListAsync(CancellationToken ct) => documents.QueryAsync<PlanDefinition>(Containers.Catalog, "plans", StorageQuery.Type("plan"), ct, 1000);
    public async Task<PlanDefinition> PublishAsync(PlanDefinition plan, Operation operation, CancellationToken ct)
    {
        if (await documents.ReplayAsync<PlanDefinition>(Containers.Catalog, "plans", operation, ct) is { } prior)
            return prior;
        try
        {
            await documents.CommitAsync(documents.Batch(Containers.Catalog, "plans").CreateItem(Row("plan:" + plan.Id, "plans", "plan", plan)).CreateItem(Receipt("plans", operation, plan)).CreateItem(Audit("plans", operation, "billing.plan_publish", plan.Id)), ct);
            return plan;
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            var replay = await documents.ReplayAsync<PlanDefinition>(Containers.Catalog, "plans", operation, ct);
            if (replay is not null)
                return replay;
            throw;
        }
    }
}
