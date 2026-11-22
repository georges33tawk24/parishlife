// Purpose: the archdiocese's sacrament preparation checklists (owner decision, 21 November 2026: the archdiocese sets one checklist per
// sacrament for all its parishes). The current bishop saves them; parishes then use them in place of their own (SacramentService), and a
// parish's own list for that sacrament can no longer be saved. There is no built-in list: an empty list clears the archdiocese's checklist,
// and its parishes fall back to their own lists, if any.
// Main functions: ListAsync, SaveAsync, ForParishAsync (the archdiocese list that applies to a parish, if any) and Key.

using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Sacraments;

public class ArchdioceseRequirementService(IRecordTransactions records, IArchdioceseAuthority bishops, ICurrentActor actor, TimeProvider clock)
{
    internal static readonly string[] Kinds = ["Baptism", "FirstCommunion", "Confirmation", "Marriage", "Funeral", "Anointing", "Other"];
    internal static string Key(string sacrament) => "sacramentRequirements:" + sacrament;
    private static RecordScope Scope(string archdiocese) => new() { Area = RecordArea.Archdiocese, OwnerId = archdiocese };

    public async Task<IReadOnlyList<RequirementSetDto>> ListAsync(string archdiocese, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdiocese, ct);
        var result = new List<RequirementSetDto>();
        foreach (var kind in Kinds)
            if (await records.ReadAsync<SacramentRequirementSet>(Scope(archdiocese), Key(kind), ct) is { Value.Items.Length: > 0 } row)
                result.Add(Project(row, "Archdiocese"));
        return result;
    }

    public async Task<RequirementSetDto?> SaveAsync(string archdiocese, SaveRequirementSetDto request, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdiocese, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "archdiocese-requirements:v1:" + archdiocese + ":" + request.Sacrament);
        var key = Key(request.Sacrament);
        if (await records.ReplayAsync<CommandResult>(Scope(archdiocese), op, ct) is null)
        {
            var items = RequirementItems.Validate(request.Items);
            var existing = await records.ReadAsync<SacramentRequirementSet>(Scope(archdiocese), key, ct);
            if (existing is null && request.Version is not null || existing is not null && existing.Version != Versions.Require(request.Version))
                throw new DomainException("write_conflict", "The checklist changed; reload it first.", FailureKind.Conflict);
            var set = new SacramentRequirementSet
            {
                Sacrament = request.Sacrament, Items = items, BlockSchedulingUntilMet = request.BlockSchedulingUntilMet, SavedBy = actor.AccountId, SavedAt = op.At
            };
            // Later cases use it; a case keeps its checklist until the office synchronizes it, as for a parish list.
            await records.CommitAsync(Scope(archdiocese), op, "sacrament.archdiocese_requirements", request.Sacrament,
                [existing is null ? RecordChange.Create(key, "sacramentRequirements", set) : RecordChange.Replace(key, "sacramentRequirements", set, existing.Version)],
                new CommandResult { Id = request.Sacrament, Status = "Saved" }, ct);
        }
        var saved = await records.ReadAsync<SacramentRequirementSet>(Scope(archdiocese), key, ct);
        return saved is { Value.Items.Length: > 0 } ? Project(saved, "Archdiocese") : null;
    }

    // The archdiocese's list for this sacrament, when the parish has a confirmed archdiocese that has set one (an empty list counts as none).
    internal async Task<Versioned<SacramentRequirementSet>?> ForParishAsync(Parish? parish, string sacrament, CancellationToken ct)
        => parish?.JurisdictionArchdioceseId is { } archdiocese
            && await records.ReadAsync<SacramentRequirementSet>(Scope(archdiocese), Key(sacrament), ct) is { Value.Items.Length: > 0 } row ? row : null;

    internal static RequirementSetDto Project(Versioned<SacramentRequirementSet> row, string source) => new()
    {
        Sacrament = row.Value.Sacrament, Version = row.Version, Items = [.. row.Value.Items], BlockSchedulingUntilMet = row.Value.BlockSchedulingUntilMet,
        SavedBy = row.Value.SavedBy, SavedAt = row.Value.SavedAt, Source = source
    };
}
