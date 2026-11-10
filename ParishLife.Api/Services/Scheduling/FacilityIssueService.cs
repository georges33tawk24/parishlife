// Purpose: manages reported facility/equipment problems from report through triage, repair and qualified resolution.
// Main functions: ReportAsync, ActAsync, GetAsync and ListAsync. Urgent issues and hazards are resolved only with evidence and by someone
// other than the reporter, so nobody clears their own unverified hazard. Serviceability changes stay with the facility and equipment paths.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Scheduling;

public class FacilityIssueService(IRecordTransactions records, IParishAccess access, IAccountDirectory accounts, ICurrentActor actor,
    MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "facilityIssue:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested issue is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_issue_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> AuthorizeAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "facilities", ct);
        return root;
    }

    // Facility managers and scheduling staff can report; triage and resolution stay with facility managers.
    public async Task<FacilityIssueDto> ReportAsync(string parish, ReportIssueDto request, CancellationToken ct)
    {
        Versioned<Parish> root;
        try { root = await AuthorizeAsync(parish, Permissions.FacilitiesManage, ct); }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden)
        {
            root = await AuthorizeAsync(parish, Permissions.ScheduleRead, ct);
        }
        var op = actor.CreateOperation(request.OperationId, request, clock, "facility-issue:v1");
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        var resource = Guard.Id(request.ResourceId);
        var exists = request.ResourceKind switch
        {
            "Facility" => (await records.ReadAsync<Facility>(SchedulingScope.For(parish), "facility:" + resource, ct))?.Value.ParishId == parish,
            "Equipment" => (await records.ReadAsync<FacilityEquipment>(Scope(parish), EquipmentService.Key(resource), ct))?.Value.ParishId == parish,
            _ => false
        };
        if (!exists || request.Urgency is not ("Low" or "Normal" or "Urgent" or "Hazard"))
            throw Missing();
        var item = new FacilityIssue
        {
            Id = op.Id, ParishId = parish, ResourceId = resource, ResourceKind = request.ResourceKind,
            Description = Guard.Text(request.Description, "Description", 4000), Urgency = request.Urgency,
            Evidence = string.IsNullOrWhiteSpace(request.Evidence) ? null : Guard.Text(request.Evidence, "Evidence", 1000),
            ReportedBy = actor.AccountId, ReportedAt = op.At
        };
        await records.CommitAsync(Scope(parish), op, "facilities.issue_report", resource, [Fence(root), RecordChange.Create(Key(item.Id), "facilityIssue", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<FacilityIssueDto> ActAsync(string parish, string id, IssueActionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.FacilitiesManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "facility-issue-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        var serious = item.Urgency is "Urgent" or "Hazard";
        switch (request.Action)
        {
            case "triage" when item.Status == "Reported":
                if (request.AssignedTo is { } assigned)
                {
                    item.AssignedTo = Guard.Id(assigned);
                    if (!await accounts.IsActiveVerifiedAsync(item.AssignedTo, ct))
                        throw new DomainException("invalid_input", "Assign repairs to an active verified account.");
                }
                item.TriageNote = string.IsNullOrWhiteSpace(request.Note) ? null : Guard.Text(request.Note, "Triage note", 2000);
                item.TriagedBy = actor.AccountId;
                item.Status = "Triaged";
                break;
            case "start-repair" when item.Status == "Triaged":
                item.Status = "InRepair";
                break;
            case "resolve" when item.Status is "Triaged" or "InRepair":
                if (serious && item.ReportedBy == actor.AccountId)
                    throw State("An urgent issue or hazard is cleared by someone other than its reporter.");
                item.ResolutionEvidence = Guard.Text(request.Evidence, "Resolution evidence", 1000);
                item.CostNote = string.IsNullOrWhiteSpace(request.CostNote) ? null : Guard.Text(request.CostNote, "Cost note", 500);
                item.ResolvedBy = actor.AccountId;
                item.ResolvedAt = op.At;
                item.Status = "Resolved";
                break;
            case "dismiss" when item.Status is "Reported" or "Triaged":
                if (serious && item.ReportedBy == actor.AccountId)
                    throw State("An urgent issue or hazard is dismissed by someone other than its reporter.");
                item.TriageNote = Guard.Text(request.Note, "Dismissal reason", 2000);
                item.ResolvedBy = actor.AccountId;
                item.ResolvedAt = op.At;
                item.Status = "Dismissed";
                break;
            default:
                throw State("This issue action is not available in its current state.");
        }
        await records.CommitAsync(Scope(parish), op, "facilities.issue_" + request.Action.Replace('-', '_'), item.ResourceId,
            [Fence(root), RecordChange.Replace(Key(item.Id), "facilityIssue", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<Versioned<FacilityIssueDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.FacilitiesManage, ct);
        var row = await ReadAsync(parish, id, ct);
        return new Versioned<FacilityIssueDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<Page<Versioned<FacilityIssueDto>>> ListAsync(string parish, string? status, int size, string? cursor, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.FacilitiesManage, ct);
        var page = status is null
            ? await records.PageAsync<FacilityIssue>(Scope(parish), "facilityIssue", size, cursor, ct)
            : await records.PageAsync<FacilityIssue>(Scope(parish), "facilityIssue", size, cursor, ct,
                new RecordCondition { Path = "status", Comparison = "eq", Value = Guard.Text(status, "Status", 30) });
        return new Page<Versioned<FacilityIssueDto>>
        {
            Items = page.Items.Select(r => new Versioned<FacilityIssueDto> { Version = r.Version, Value = Project(r.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    private async Task<Versioned<FacilityIssue>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<FacilityIssue>(Scope(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static FacilityIssueDto Project(FacilityIssue x) => new()
    {
        Id = x.Id, ResourceId = x.ResourceId, ResourceKind = x.ResourceKind, Description = x.Description, Urgency = x.Urgency, Evidence = x.Evidence,
        Status = x.Status, ReportedBy = x.ReportedBy, ReportedAt = x.ReportedAt, TriagedBy = x.TriagedBy, AssignedTo = x.AssignedTo,
        TriageNote = x.TriageNote, ResolvedBy = x.ResolvedBy, ResolvedAt = x.ResolvedAt, ResolutionEvidence = x.ResolutionEvidence, CostNote = x.CostNote
    };
}
