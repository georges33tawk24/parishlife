// Purpose: lets a linked member see their own data in a parish and ask for it to be closed. Office reviewers preview what stays (official,
// financial, safeguarding and participation history), what optional data would be removed and which access would end. Approval removes
// only optional personal data, withdraws consents, ends the account link and archives the person. No retention period is invented here.
// Main functions: OwnDataAsync, RequestAsync, OwnRequestsAsync, QueueAsync, PreviewAsync and DecideAsync.

using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.People;

public class PersonDataService(IRecordTransactions records, IParishAccess access, MinistryAccess own, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    // Records that keep their history under the parish's (not yet approved) retention policy; closure never deletes them.
    private static readonly string[] KeptTypes = ["sacramentRecord", "contribution", "registration", "volunteerAssignment", "householdMember", "pledge"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordCondition Person(string person) => new() { Path = "personId", Comparison = "eq", Value = person };
    private static DomainException Missing() => new("resource_not_found", "The requested data request is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_data_request_state", message, FailureKind.Conflict);

    private async Task<Versioned<Parish>> OfficeAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.PeopleWrite, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    public async Task<OwnDataDto> OwnDataAsync(string parish, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        var person = (await records.ReadAsync<Person>(Scope(parish), "person:" + link.Value.PersonId, ct))!.Value;
        var facts = (await records.ReadAsync<PersonFacts>(Scope(parish), "personFacts:" + person.Id, ct))?.Value;
        return new OwnDataDto
        {
            PersonId = person.Id, GivenName = person.GivenName, FamilyName = person.FamilyName, BirthDate = person.BirthDate, Contact = person.Contact,
            Facts = facts is null ? null : PersonFactsService.Project(facts),
            Consents = (await records.CollectAsync<PersonConsent>(Scope(parish), "personConsent", ct, 500, Person(person.Id))).Select(c => PersonFactsService.Project(c.Value)).ToArray(),
            Records = await CountsAsync(parish, person.Id, ct)
        };
    }

    public async Task<DataClosureRequestDto> RequestAsync(string parish, DataClosureRequestDto request, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, new { request.Details }, clock, "data-closure:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project(await ReadAsync(parish, prior.Id, ct));
        if ((await OwnRowsAsync(parish, ct)).Any(r => r.Value.Status == "Submitted"))
            throw State("You already have a closure request waiting for review.");
        var item = new DataClosureRequest
        {
            Id = op.Id, ParishId = parish, AccountId = actor.AccountId, PersonId = link.Value.PersonId, SubmittedAt = op.At,
            Details = string.IsNullOrWhiteSpace(request.Details) ? null : Guard.Text(request.Details, "Details", 2000)
        };
        await records.CommitAsync(Scope(parish), op, "person.data_closure_request", item.Id, [RecordChange.Create("dataClosure:" + item.Id, "dataClosure", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(await ReadAsync(parish, item.Id, ct));
    }

    // After approval the account is no longer linked, so the requester follows it by account rather than by person link.
    public async Task<IReadOnlyList<DataClosureRequestDto>> OwnRequestsAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        return (await OwnRowsAsync(parish, ct)).Select(Project).ToArray();
    }

    public async Task<IReadOnlyList<DataClosureRequestDto>> QueueAsync(string parish, CancellationToken ct)
    {
        await OfficeAsync(parish, ct);
        return (await records.CollectAsync<DataClosureRequest>(Scope(parish), "dataClosure", ct, 2000)).OrderBy(r => r.Value.SubmittedAt).Select(Project).ToArray();
    }

    public async Task<DataClosurePreviewDto> PreviewAsync(string parish, string id, CancellationToken ct)
    {
        await OfficeAsync(parish, ct);
        var item = (await ReadAsync(parish, id, ct)).Value;
        return new DataClosurePreviewDto
        {
            PersonId = item.PersonId, Kept = await CountsAsync(parish, item.PersonId, ct),
            Removed = ["contact on the person record", "optional facts (locality, occupation, skills, language)", "medical declarations", "given consents (recorded as withdrawn)"],
            Ends = ["the account's link to this person", "parish follow and member access through this link"]
        };
    }

    public async Task<DataClosureRequestDto> DecideAsync(string parish, string id, DataClosureDecisionDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "data-closure-decision:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project(await ReadAsync(parish, id, ct));
        var row = await ReadAsync(parish, id, ct);
        var item = row.Value;
        if (item.Status != "Submitted")
            throw State("This request was already decided.");
        if (item.AccountId == actor.AccountId)
            throw State("A different reviewer decides your own request.");
        var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", root.Value, root.Version) };
        var outcome = new List<string>();
        if (request.Approve)
        {
            var person = await records.ReadAsync<Person>(Scope(parish), "person:" + item.PersonId, ct) ?? throw Missing();
            person.Value.Contact = null;
            person.Value.Archived = true;
            changes.Add(RecordChange.Replace("person:" + item.PersonId, "person", person.Value, person.Version));
            outcome.Add("Contact removed and person archived; official, financial and participation history kept.");
            if (await records.ReadAsync<PersonFacts>(Scope(parish), "personFacts:" + item.PersonId, ct) is { } facts)
            {
                changes.Add(RecordChange.Remove("personFacts:" + item.PersonId, facts.Version));
                outcome.Add("Optional facts removed.");
            }
            if (await records.ReadAsync<PersonMedical>(Scope(parish), "personMedical:" + item.PersonId, ct) is { } medical)
            {
                changes.Add(RecordChange.Remove("personMedical:" + item.PersonId, medical.Version));
                outcome.Add("Medical declarations removed.");
            }
            foreach (var consent in (await records.CollectAsync<PersonConsent>(Scope(parish), "personConsent", ct, 500, Person(item.PersonId))).Where(c => c.Value.Status == "Given"))
            {
                consent.Value.Status = "Withdrawn";
                consent.Value.WithdrawnAt = op.At;
                consent.Value.WithdrawalReason = "Personal data closure request";
                changes.Add(RecordChange.Replace("personConsent:" + consent.Value.Id, "personConsent", consent.Value, consent.Version));
            }
            if (await records.ReadAsync<PersonAccountLink>(Scope(parish), "personAccountLink:" + item.AccountId, ct) is { } link && link.Value.Active)
            {
                link.Value.Active = false;
                changes.Add(RecordChange.Replace("personAccountLink:" + item.AccountId, "personAccountLink", link.Value, link.Version));
                outcome.Add("Account link ended.");
            }
            if (changes.Count > 95)
                throw State("This closure touches too many records for one step; withdraw some consents first.");
        }
        item.Status = request.Approve ? "Completed" : "Declined";
        item.Reason = Guard.Text(request.Reason, "Reason", 1000);
        item.Outcome = [.. outcome];
        item.DecidedBy = actor.AccountId;
        item.DecidedAt = op.At;
        changes.Add(RecordChange.Replace("dataClosure:" + id, "dataClosure", item, Versions.Require(request.Version)));
        await records.CommitAsync(Scope(parish), op, "person.data_closure_" + (request.Approve ? "complete" : "decline"), id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(await ReadAsync(parish, id, ct));
    }

    private async Task<Dictionary<string, int>> CountsAsync(string parish, string person, CancellationToken ct)
    {
        var result = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var type in KeptTypes)
            if ((await records.CollectAsync<object>(Scope(parish), type, ct, 5000, Person(person))).Count is > 0 and var count)
                result[type] = count;
        return result;
    }

    private async Task<IReadOnlyList<Versioned<DataClosureRequest>>> OwnRowsAsync(string parish, CancellationToken ct)
        => (await records.CollectAsync<DataClosureRequest>(Scope(parish), "dataClosure", ct, 200, new RecordCondition { Path = "accountId", Comparison = "eq", Value = actor.AccountId }));

    private async Task<Versioned<DataClosureRequest>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<DataClosureRequest>(Scope(parish), "dataClosure:" + id, ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    private static DataClosureRequestDto Project(Versioned<DataClosureRequest> row) => new()
    {
        Id = row.Value.Id, Version = row.Version, Details = row.Value.Details, Status = row.Value.Status, SubmittedAt = row.Value.SubmittedAt,
        Reason = row.Value.Reason, Outcome = row.Value.Outcome, DecidedAt = row.Value.DecidedAt
    };
}
