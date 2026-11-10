// Purpose: suggests possible duplicate people from at least two agreeing signals (a shared name alone is never enough), records reviewers'
// "different" / "need information" decisions, and merges or unmerges people with explicit field choices and before-snapshots.
// Main functions: SuggestAsync, DecideAsync, PreviewMergeAsync, MergeAsync, UnmergeAsync and MergesAsync.

using System.Globalization;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.People;

public class DuplicateService(IRecordTransactions records, IParishAccess access, IClergyAuthority clergy, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static readonly string[] Fields = ["GivenName", "FamilyName", "BirthDate", "Contact"];
    // Records that keep pointing at the merged-away person; they stay individually traceable and are listed, never rewritten.
    private static readonly string[] DependentTypes = ["sacramentRecord", "registration", "volunteerAssignment", "householdMember", "personConsent"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested person is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_merge_state", message, FailureKind.Conflict);
    private static string PairKey(string a, string b) => string.CompareOrdinal(a, b) < 0 ? a + ":" + b : b + ":" + a;

    private async Task<Versioned<Parish>> OfficeAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    public async Task<IReadOnlyList<DuplicateSuggestionDto>> SuggestAsync(string parish, CancellationToken ct)
    {
        await OfficeAsync(parish, Permissions.PeopleRead, ct);
        var people = (await records.CollectAsync<Person>(Scope(parish), "person", ct, 20000)).Select(r => r.Value).Where(p => !p.Archived).ToList();
        var decisions = (await records.CollectAsync<DuplicateDecision>(Scope(parish), "duplicateDecision", ct, 5000)).ToDictionary(d => PairKey(d.Value.PersonA, d.Value.PersonB), d => d.Value.Decision);
        var linked = (await records.CollectAsync<PersonAccountLink>(Scope(parish), "personAccountLink", ct, 20000)).Where(l => l.Value.Active)
            .Select(l => l.Value.PersonId).ToHashSet(StringComparer.Ordinal);
        var result = new List<DuplicateSuggestionDto>();
        // ponytail: groups by normalized family name before comparing pairs; a phonetic/transliteration index is the upgrade for large parishes.
        foreach (var group in people.GroupBy(p => PeopleDirectoryService.Normalize(p.FamilyName)))
        {
            var list = group.ToList();
            for (var i = 0; i < list.Count; i++)
            for (var j = i + 1; j < list.Count; j++)
            {
                var (a, b) = (list[i], list[j]);
                var signals = new List<string>();
                if (PeopleDirectoryService.Normalize(a.GivenName) == PeopleDirectoryService.Normalize(b.GivenName)) signals.Add("Same given name");
                if (a.BirthDate is not null && a.BirthDate == b.BirthDate) signals.Add("Same birth date");
                if (a.Contact is not null && PeopleDirectoryService.Normalize(a.Contact) == PeopleDirectoryService.Normalize(b.Contact ?? "")) signals.Add("Same contact");
                if (signals.Count < 2 || decisions.GetValueOrDefault(PairKey(a.Id, b.Id)) == "different")
                    continue;
                result.Add(new DuplicateSuggestionDto
                {
                    PersonA = a.Id, PersonB = b.Id, NameA = a.GivenName + " " + a.FamilyName, NameB = b.GivenName + " " + b.FamilyName,
                    Signals = ["Same family name", .. signals], Differences = Fields.Where(f => Value(a, f) != Value(b, f)).ToArray(),
                    LinkedA = linked.Contains(a.Id), LinkedB = linked.Contains(b.Id), Decision = decisions.GetValueOrDefault(PairKey(a.Id, b.Id))
                });
            }
        }
        return result;
    }

    public async Task DecideAsync(string parish, DuplicateDecisionDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, Permissions.PeopleWrite, ct);
        var (a, b) = (Guard.Id(request.PersonA), Guard.Id(request.PersonB));
        var op = actor.CreateOperation(request.OperationId, request, clock, "duplicate-decision:v1:" + PairKey(a, b));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return;
        await PersonAsync(parish, a, ct);
        await PersonAsync(parish, b, ct);
        var key = "duplicateDecision:" + PairKey(a, b);
        var old = await records.ReadAsync<DuplicateDecision>(Scope(parish), key, ct);
        var item = new DuplicateDecision
        {
            Id = PairKey(a, b), ParishId = parish, PersonA = a, PersonB = b, Decision = request.Decision, Reason = Guard.Text(request.Reason, "Reason", 1000),
            By = actor.AccountId, At = op.At
        };
        await records.CommitAsync(Scope(parish), op, "person.duplicate_decision", item.Id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), old is null ? RecordChange.Create(key, "duplicateDecision", item) : RecordChange.Replace(key, "duplicateDecision", item, old.Version)],
            new CommandResult { Id = item.Id, Status = item.Decision }, ct);
    }

    public async Task<MergePreviewDto> PreviewMergeAsync(string parish, string survivor, string source, CancellationToken ct)
    {
        await OfficeAsync(parish, Permissions.PeopleRead, ct);
        return await PreviewAsync(parish, (await PersonAsync(parish, survivor, ct)).Value, (await PersonAsync(parish, source, ct)).Value, ct);
    }

    public async Task<PersonMergeDto> MergeAsync(string parish, MergePeopleDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, Permissions.PeopleWrite, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-merge:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadMergeAsync(parish, prior.Id, ct)));
        var survivorRow = await PersonAsync(parish, Guard.Id(request.SurvivorId), ct);
        var sourceRow = await PersonAsync(parish, Guard.Id(request.SourceId), ct);
        var (survivor, source) = (survivorRow.Value, sourceRow.Value);
        if (survivor.Id == source.Id || survivor.Archived || source.Archived)
            throw State("Choose two different, current people.");
        var preview = await PreviewAsync(parish, survivor, source, ct);
        // Account-person links are identity facts: only an unlinked record can be merged away.
        if (preview.SourceLinked)
            throw State(preview.SurvivorLinked ? "Both people are linked to accounts; resolve that through identity review first." : "Keep the account-linked person as the survivor.");
        if (preview.NeedsPriest)
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        var choices = request.Choices ?? new();
        if (preview.Conflicts.Any(f => choices.GetValueOrDefault(f) is not ("survivor" or "source")) || choices.Keys.Any(k => !preview.Conflicts.Contains(k)))
            throw new DomainException("invalid_input", "Choose survivor or source for every differing field: " + string.Join(", ", preview.Conflicts) + ".");
        var before = Copy(survivor);
        var sourceBefore = Copy(source);
        foreach (var (field, choice) in choices)
            if (choice == "source")
                Set(survivor, field, source);
        source.Archived = true;
        var merge = new PersonMerge
        {
            Id = op.Id, ParishId = parish, SurvivorId = survivor.Id, SourceId = source.Id, SurvivorBefore = before, SourceBefore = sourceBefore,
            SurvivorAfter = Copy(survivor), Choices = new(choices), Reason = Guard.Text(request.Reason, "Reason", 1000), By = actor.AccountId, At = op.At
        };
        await records.CommitAsync(Scope(parish), op, "person.merge", merge.Id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version),
             RecordChange.Replace("person:" + survivor.Id, "person", survivor, survivorRow.Version),
             RecordChange.Replace("person:" + source.Id, "person", source, sourceRow.Version),
             RecordChange.Create("personMerge:" + merge.Id, "personMerge", merge)],
            new CommandResult { Id = merge.Id, Status = merge.Status }, ct);
        return Project(await ReadMergeAsync(parish, merge.Id, ct));
    }

    // Restores both people only while the survivor is unchanged since the merge; later edits need a separate reviewed correction.
    public async Task<PersonMergeDto> UnmergeAsync(string parish, string id, UnmergePeopleDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, Permissions.PeopleWrite, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-unmerge:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(await ReadMergeAsync(parish, id, ct));
        var merge = (await ReadMergeAsync(parish, id, ct)).Value;
        if (merge.Status != "Merged")
            throw State("This merge was already undone.");
        var survivorRow = await PersonAsync(parish, merge.SurvivorId, ct);
        var sourceRow = await PersonAsync(parish, merge.SourceId, ct);
        if (Fields.Any(f => Value(survivorRow.Value, f) != Value(merge.SurvivorAfter, f)) || survivorRow.Value.Archived || !sourceRow.Value.Archived)
            throw State("The people changed after the merge; correct them through a separate reviewed change.");
        merge.Status = "Unmerged";
        merge.UnmergedBy = actor.AccountId;
        merge.UnmergedAt = op.At;
        merge.UnmergeReason = Guard.Text(request.Reason, "Reason", 1000);
        await records.CommitAsync(Scope(parish), op, "person.unmerge", id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version),
             RecordChange.Replace("person:" + merge.SurvivorId, "person", merge.SurvivorBefore, survivorRow.Version),
             RecordChange.Replace("person:" + merge.SourceId, "person", merge.SourceBefore, sourceRow.Version),
             RecordChange.Replace("personMerge:" + id, "personMerge", merge, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = merge.Status }, ct);
        return Project(await ReadMergeAsync(parish, id, ct));
    }

    public async Task<IReadOnlyList<PersonMergeDto>> MergesAsync(string parish, CancellationToken ct)
    {
        await OfficeAsync(parish, Permissions.PeopleRead, ct);
        return (await records.CollectAsync<PersonMerge>(Scope(parish), "personMerge", ct, 2000)).OrderByDescending(r => r.Value.At).Select(Project).ToArray();
    }

    private async Task<MergePreviewDto> PreviewAsync(string parish, Person survivor, Person source, CancellationToken ct)
    {
        var dependents = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var type in DependentTypes)
            if ((await records.CollectAsync<object>(Scope(parish), type, ct, 1000, Equal("personId", source.Id))).Count is > 0 and var count)
                dependents[type] = count;
        async Task<bool> Linked(string person) => (await records.ReadAsync<CommandResult>(Scope(parish), "personAccountClaim:" + person, ct))?.Value.Status == "Linked";
        return new MergePreviewDto
        {
            Conflicts = Fields.Where(f => Value(survivor, f) != Value(source, f)).ToArray(), Dependents = dependents,
            SourceLinked = await Linked(source.Id), SurvivorLinked = await Linked(survivor.Id),
            NeedsPriest = dependents.ContainsKey("sacramentRecord") || (await records.CollectAsync<object>(Scope(parish), "sacramentRecord", ct, 1, Equal("personId", survivor.Id))).Count > 0
        };
    }

    private async Task<Versioned<Person>> PersonAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<Person>(Scope(parish), "person:" + id, ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    private async Task<Versioned<PersonMerge>> ReadMergeAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<PersonMerge>(Scope(parish), "personMerge:" + id, ct) ?? throw Missing();

    private static string? Value(Person p, string field) => field switch
    {
        "GivenName" => p.GivenName,
        "FamilyName" => p.FamilyName,
        "BirthDate" => p.BirthDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        _ => p.Contact
    };

    private static void Set(Person target, string field, Person from)
    {
        switch (field)
        {
            case "GivenName": target.GivenName = from.GivenName; break;
            case "FamilyName": target.FamilyName = from.FamilyName; break;
            case "BirthDate": target.BirthDate = from.BirthDate; break;
            case "Contact": target.Contact = from.Contact; break;
        }
    }

    private static Person Copy(Person p) => new()
    {
        Id = p.Id, ParishId = p.ParishId, GivenName = p.GivenName, FamilyName = p.FamilyName, BirthDate = p.BirthDate, Contact = p.Contact,
        CreatedBy = p.CreatedBy, CreatedAt = p.CreatedAt, Archived = p.Archived
    };

    private static PersonMergeDto Project(Versioned<PersonMerge> row) => new()
    {
        Id = row.Value.Id, Version = row.Version, SurvivorId = row.Value.SurvivorId, SourceId = row.Value.SourceId, Choices = new(row.Value.Choices),
        Reason = row.Value.Reason, By = row.Value.By, At = row.Value.At, Status = row.Value.Status, UnmergedAt = row.Value.UnmergedAt, UnmergeReason = row.Value.UnmergeReason
    };
}
