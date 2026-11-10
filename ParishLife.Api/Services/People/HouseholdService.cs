// Purpose: manages households (shared contact/residence units) and person-to-person relationships without conferring authority.
// Main functions: SaveAsync, MemberAsync, GetAsync, ListAsync, HistoryAsync, AddRelationshipAsync, EndRelationshipAsync and
// RelationshipsAsync; helpers enforce one primary household per person, unique envelope identifiers, mirrored relationship pairs
// and acyclic parentage. Household membership never grants guardianship, giving, message or certificate access.

using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.People;

public class HouseholdService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static readonly IReadOnlyDictionary<string, string> Mirror = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["Parent"] = "Child", ["Child"] = "Parent", ["AdoptiveParent"] = "AdoptiveChild", ["AdoptiveChild"] = "AdoptiveParent",
        ["StepParent"] = "StepChild", ["StepChild"] = "StepParent", ["Spouse"] = "Spouse", ["Sibling"] = "Sibling",
        ["Guardian"] = "Ward", ["Ward"] = "Guardian", ["Relative"] = "Relative"
    };
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string HouseholdKey(string id) => "household:" + id;
    private static string MemberKey(string person) => "householdMember:" + person;
    private static string EnvelopeKey(string envelope) => "householdEnvelope:" + envelope.ToUpperInvariant();
    private static string RelationshipKey(string id) => "personRelationship:" + id;
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested household or person is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_household_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> AuthorizeAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    public async Task<HouseholdDto> SaveAsync(string parish, string? id, SaveHouseholdDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.PeopleWrite, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "household:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await ProjectAsync(parish, (await ReadAsync(parish, prior.Id, ct)).Value, ct);
        var envelope = string.IsNullOrWhiteSpace(request.EnvelopeId) ? null : Guard.Text(request.EnvelopeId, "Envelope identifier", 40);
        var address = string.IsNullOrWhiteSpace(request.Address) ? null : Guard.Text(request.Address, "Address", 1000);
        var changes = new List<RecordChange> { Fence(root) };
        Household item;
        if (id is null)
        {
            if (request.Version is not null)
                throw State("A new household has no version.");
            item = new Household { Id = op.Id, ParishId = parish };
            changes.Add(RecordChange.Create(HouseholdKey(item.Id), "household", item));
        }
        else
        {
            var row = await ReadAsync(parish, id, ct);
            item = row.Value;
            if (item.Status != "Active")
                throw State("Only an active household can be edited.");
            if (item.Address != address)
                changes.Add(History(item.Id, null, "address", item.Address, op));
            changes.Add(RecordChange.Replace(HouseholdKey(item.Id), "household", item, Versions.Require(request.Version)));
        }
        if (!string.Equals(item.EnvelopeId, envelope, StringComparison.OrdinalIgnoreCase))
        {
            // Envelope identifiers are assigned manually and claimed atomically so two households can never share one.
            if (envelope is not null)
            {
                if (await records.ReadAsync<CommandResult>(Scope(parish), EnvelopeKey(envelope), ct) is not null)
                    throw State("That envelope identifier is already assigned in this parish.");
                changes.Add(RecordChange.Create(EnvelopeKey(envelope), "householdEnvelope", new CommandResult { Id = item.Id, Status = "Assigned" }));
            }
            if (item.EnvelopeId is { } old && await records.ReadAsync<CommandResult>(Scope(parish), EnvelopeKey(old), ct) is { } claim)
                changes.Add(RecordChange.Remove(EnvelopeKey(old), claim.Version));
            if (id is not null)
                changes.Add(History(item.Id, null, "envelope", item.EnvelopeId, op));
        }
        item.Name = Guard.Text(request.Name, "Household name", 200);
        item.Address = address;
        item.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : Guard.Text(request.Phone, "Phone", 50);
        item.EnvelopeId = envelope;
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "people.household_save", item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await ProjectAsync(parish, item, ct);
    }

    public async Task<HouseholdDto> MemberAsync(string parish, string household, HouseholdMemberActionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.PeopleWrite, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "household-member:v1:" + household);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await ProjectAsync(parish, (await ReadAsync(parish, household, ct)).Value, ct);
        var item = (await ReadAsync(parish, household, ct)).Value;
        if (item.Status != "Active")
            throw State("Only an active household changes members.");
        var person = Guard.Id(request.PersonId);
        var subject = (await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct))?.Value;
        if (subject is null || subject.ParishId != parish)
            throw Missing();
        var member = await records.ReadAsync<HouseholdMember>(Scope(parish), MemberKey(person), ct);
        var inHousehold = member?.Value.HouseholdId == household;
        var changes = new List<RecordChange> { Fence(root), RecordChange.Replace(HouseholdKey(item.Id), "household", item, Versions.Require(request.Version)) };
        switch (request.Action)
        {
            case "add":
                if (subject.Archived)
                    throw State("Restore or review an archived person before adding them to a household.");
                // One primary household per person; a move is an explicit remove from the old household first.
                if (member is not null && member.Value.HouseholdId.Length > 0)
                    throw State("This person already has a primary household; remove them from it first.");
                var joined = new HouseholdMember
                {
                    PersonId = person, HouseholdId = household, InheritsAddress = request.InheritsAddress, JoinedAt = op.At, UpdatedBy = actor.AccountId,
                    OwnAddress = string.IsNullOrWhiteSpace(request.OwnAddress) ? null : Guard.Text(request.OwnAddress, "Own address", 1000)
                };
                changes.Add(member is null ? RecordChange.Create(MemberKey(person), "householdMember", joined)
                    : RecordChange.Replace(MemberKey(person), "householdMember", joined, member.Version));
                changes.Add(History(household, person, "add", null, op));
                break;
            case "update" when inHousehold:
                // Only this person's own address choice changes; login contacts and other members are untouched.
                var previous = member!.Value.InheritsAddress ? "inherits" : member.Value.OwnAddress;
                member.Value.InheritsAddress = request.InheritsAddress;
                member.Value.OwnAddress = string.IsNullOrWhiteSpace(request.OwnAddress) ? null : Guard.Text(request.OwnAddress, "Own address", 1000);
                member.Value.UpdatedBy = actor.AccountId;
                changes.Add(RecordChange.Replace(MemberKey(person), "householdMember", member.Value, member.Version));
                changes.Add(History(household, person, "update", previous, op));
                break;
            case "remove" when inHousehold:
                member!.Value.HouseholdId = "";
                member.Value.UpdatedBy = actor.AccountId;
                if (item.ContactPersonId == person)
                    item.ContactPersonId = null;
                changes.Add(RecordChange.Replace(MemberKey(person), "householdMember", member.Value, member.Version));
                changes.Add(History(household, person, "remove", household, op));
                break;
            case "set-contact" when inHousehold:
                changes.Add(History(household, person, "set-contact", item.ContactPersonId, op));
                item.ContactPersonId = person;
                break;
            default:
                throw State("This member action needs a person who is (or, for add, is not yet) in this household.");
        }
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "people.household_" + request.Action.Replace('-', '_'), household, changes,
            new CommandResult { Id = household, Status = item.Status }, ct);
        return await ProjectAsync(parish, item, ct);
    }

    public async Task<Versioned<HouseholdDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.PeopleRead, ct);
        var row = await ReadAsync(parish, id, ct);
        return new Versioned<HouseholdDto> { Version = row.Version, Value = await ProjectAsync(parish, row.Value, ct) };
    }

    public async Task<Page<Versioned<HouseholdDto>>> ListAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.PeopleRead, ct);
        var page = await records.PageAsync<Household>(Scope(parish), "household", size, cursor, ct);
        return new Page<Versioned<HouseholdDto>>
        {
            Items = page.Items.Select(row => new Versioned<HouseholdDto> { Version = row.Version, Value = Summary(row.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<Page<HouseholdChangeDto>> HistoryAsync(string parish, string id, int size, string? cursor, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.PeopleRead, ct);
        await ReadAsync(parish, id, ct);
        var page = await records.PageAsync<HouseholdChange>(Scope(parish), "householdChange", size, cursor, ct, Equal("householdId", id));
        return new Page<HouseholdChangeDto>
        {
            Items = page.Items.Select(row => new HouseholdChangeDto
            {
                Id = row.Value.Id, HouseholdId = row.Value.HouseholdId, PersonId = row.Value.PersonId, Action = row.Value.Action,
                Previous = row.Value.Previous, RecordedBy = row.Value.RecordedBy, RecordedAt = row.Value.RecordedAt
            }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<RelationshipDto> AddRelationshipAsync(string parish, string person, AddRelationshipDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.PeopleWrite, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-relationship:v1:" + person);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await ProjectAsync(parish, (await ReadRelationshipAsync(parish, person, prior.Id, ct)).Value, ct);
        var related = Guard.Id(request.RelatedPersonId);
        if (related == person || !Mirror.TryGetValue(request.Kind, out var mirror))
            throw new DomainException("invalid_input", "Relate two different people with a supported relationship kind.");
        foreach (var id in new[] { person, related })
            if ((await records.ReadAsync<Person>(Scope(parish), "person:" + id, ct))?.Value is not { } row || row.ParishId != parish)
                throw Missing();
        var evidence = string.IsNullOrWhiteSpace(request.EvidenceReference) ? null : Guard.Text(request.EvidenceReference, "Evidence", 1000);
        // Guardianship is a consequential authority fact, so it needs actual evidence; household membership never implies it.
        if (request.Kind is "Guardian" or "Ward" && evidence is null)
            throw new DomainException("invalid_input", "Guardian relationships need an actual evidence reference.");
        var existing = await ActiveRelationshipsAsync(parish, person, ct);
        if (existing.Any(r => r.RelatedPersonId == related && r.Kind == request.Kind))
            throw State("This relationship is already recorded.");
        var (child, parent) = request.Kind switch
        {
            "Parent" or "AdoptiveParent" => (person, related),
            "Child" or "AdoptiveChild" => (related, person),
            _ => ((string?)null, (string?)null)
        };
        if (child is not null && parent is not null)
        {
            if ((await ActiveRelationshipsAsync(parish, child, ct)).Count(r => r.Kind == "Parent") >= 2 && request.Kind is "Parent" or "Child")
                throw State("This person already has two recorded parents.");
            if (await AncestorsAsync(parish, parent, ct) is var ancestors && ancestors.Contains(child))
                throw State("This would make a person their own ancestor.");
        }
        var source = string.IsNullOrWhiteSpace(request.Source) ? null : Guard.Text(request.Source, "Source", 500);
        PersonRelationship Make(string id, string subject, string other, string kind) => new()
        {
            Id = id, ParishId = parish, PersonId = subject, RelatedPersonId = other, Kind = kind, PairId = op.Id, Source = source,
            EvidenceReference = evidence, CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        var forward = Make(op.Id + "a", person, related, request.Kind);
        var backward = Make(op.Id + "b", related, person, mirror);
        await records.CommitAsync(Scope(parish), op, "people.relationship_add", person,
            [Fence(root), RecordChange.Create(RelationshipKey(forward.Id), "personRelationship", forward),
             RecordChange.Create(RelationshipKey(backward.Id), "personRelationship", backward)],
            new CommandResult { Id = forward.Id, Status = forward.Status }, ct);
        return await ProjectAsync(parish, forward, ct);
    }

    public async Task<RelationshipDto> EndRelationshipAsync(string parish, string person, string relationship, EndRelationshipDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.PeopleWrite, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-relationship-end:v1:" + relationship);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await ProjectAsync(parish, (await ReadRelationshipAsync(parish, person, relationship, ct)).Value, ct);
        var row = await ReadRelationshipAsync(parish, person, relationship, ct);
        if (row.Value.Status != "Active")
            throw State("This relationship has already ended.");
        var mirrorId = row.Value.PairId + (row.Value.Id.EndsWith('a') ? "b" : "a");
        var mirror = await records.ReadAsync<PersonRelationship>(Scope(parish), RelationshipKey(mirrorId), ct) ?? throw Missing();
        var reason = Guard.Text(request.Reason, "Reason", 2000);
        foreach (var item in new[] { row.Value, mirror.Value })
        {
            item.Status = "Ended";
            item.EndedAt = op.At;
            item.EndReason = reason;
        }
        await records.CommitAsync(Scope(parish), op, "people.relationship_end", person,
            [Fence(root), RecordChange.Replace(RelationshipKey(row.Value.Id), "personRelationship", row.Value, Versions.Require(request.Version)),
             RecordChange.Replace(RelationshipKey(mirrorId), "personRelationship", mirror.Value, mirror.Version)],
            new CommandResult { Id = row.Value.Id, Status = row.Value.Status }, ct);
        return await ProjectAsync(parish, row.Value, ct);
    }

    public async Task<Page<Versioned<RelationshipDto>>> RelationshipsAsync(string parish, string person, int size, string? cursor, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.PeopleRead, ct);
        var page = await records.PageAsync<PersonRelationship>(Scope(parish), "personRelationship", size, cursor, ct, Equal("personId", person));
        var items = new List<Versioned<RelationshipDto>>();
        foreach (var row in page.Items)
            items.Add(new Versioned<RelationshipDto> { Version = row.Version, Value = await ProjectAsync(parish, row.Value, ct) });
        return new Page<Versioned<RelationshipDto>> { Items = items, ContinuationToken = page.ContinuationToken };
    }

    private async Task<List<PersonRelationship>> ActiveRelationshipsAsync(string parish, string person, CancellationToken ct)
        => (await records.CollectAsync<PersonRelationship>(Scope(parish), "personRelationship", ct, 500, Equal("personId", person)))
            .Select(r => r.Value).Where(r => r.Status == "Active").ToList();

    private async Task<HashSet<string>> AncestorsAsync(string parish, string person, CancellationToken ct)
    {
        // Walks recorded biological/adoptive parents upward (bounded depth) to reject circular parentage.
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var frontier = new List<string> { person };
        for (var depth = 0; depth < 20 && frontier.Count > 0; depth++)
        {
            var next = new List<string>();
            foreach (var id in frontier)
                foreach (var parent in (await ActiveRelationshipsAsync(parish, id, ct)).Where(r => r.Kind is "Parent" or "AdoptiveParent").Select(r => r.RelatedPersonId))
                    if (seen.Add(parent))
                        next.Add(parent);
            frontier = next;
        }
        return seen;
    }

    private RecordChange History(string household, string? person, string action, string? previous, Operation op)
        => RecordChange.Create("householdChange:" + op.Id + ":" + action, "householdChange", new HouseholdChange
        {
            Id = op.Id + ":" + action, HouseholdId = household, PersonId = person, Action = action, Previous = previous,
            RecordedBy = actor.AccountId, RecordedAt = op.At
        });

    private async Task<Versioned<Household>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<Household>(Scope(parish), HouseholdKey(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private async Task<Versioned<PersonRelationship>> ReadRelationshipAsync(string parish, string person, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<PersonRelationship>(Scope(parish), RelationshipKey(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.PersonId != person || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private async Task<string> NameAsync(string parish, string person, CancellationToken ct)
        => (await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct))?.Value is { } row ? row.GivenName + " " + row.FamilyName : "";

    private static HouseholdDto Summary(Household x) => new()
    {
        Id = x.Id, Name = x.Name, Address = x.Address, Phone = x.Phone, ContactPersonId = x.ContactPersonId, EnvelopeId = x.EnvelopeId,
        Status = x.Status, UpdatedBy = x.UpdatedBy, UpdatedAt = x.UpdatedAt
    };

    private async Task<HouseholdDto> ProjectAsync(string parish, Household item, CancellationToken ct)
    {
        var result = Summary(item);
        var members = await records.CollectAsync<HouseholdMember>(Scope(parish), "householdMember", ct, 200, Equal("householdId", item.Id));
        var list = new List<HouseholdMemberDto>();
        foreach (var member in members.Select(m => m.Value))
            list.Add(new HouseholdMemberDto
            {
                PersonId = member.PersonId, DisplayName = await NameAsync(parish, member.PersonId, ct), InheritsAddress = member.InheritsAddress,
                EffectiveAddress = member.InheritsAddress ? item.Address : member.OwnAddress, IsContact = item.ContactPersonId == member.PersonId
            });
        result.Members = [.. list];
        return result;
    }

    private async Task<RelationshipDto> ProjectAsync(string parish, PersonRelationship x, CancellationToken ct) => new()
    {
        Id = x.Id, PersonId = x.PersonId, RelatedPersonId = x.RelatedPersonId, RelatedName = await NameAsync(parish, x.RelatedPersonId, ct),
        Kind = x.Kind, Source = x.Source, EvidenceReference = x.EvidenceReference, Status = x.Status, CreatedBy = x.CreatedBy,
        CreatedAt = x.CreatedAt, EndedAt = x.EndedAt, EndReason = x.EndReason
    };
}
