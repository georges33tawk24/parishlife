// Purpose: lets the bishop of a parish's jurisdiction suspend, reinstate or close it. Suspension and closure stop ordinary parish
// operations through the shared access checks while every record, receipt and history entry stays; closure is not reversed here.
// Main functions: ChangeAsync, HistoryAsync and the bishop-only NotificationOutcomeAsync for one change's owner notice.
// Required owner notices are staged in the status transaction and can dispatch even after suspension or closure.

using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Services.Organizations;

public class ParishStatusService(IRecordTransactions records, IParishRepository parishes, IArchdioceseAuthority bishops, ICurrentActor actor,
    MfaAccountAccess proof, NotificationService notifications, TimeProvider clock, NotificationOutcomeReader outcomes)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException State(string message) => new("invalid_parish_state", message, FailureKind.Conflict);

    private async Task<Versioned<Parish>> BishopAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await parishes.GetAsync(parish, ct) ?? throw new DomainException("resource_not_found", "The requested parish is unavailable.", FailureKind.NotFound);
        await bishops.RequireBishopAsync(root.Value.JurisdictionArchdioceseId ?? throw State("Only a parish under an archdiocese's jurisdiction is handled here."), ct);
        return root;
    }

    public async Task<ParishStatusChangeDto> ChangeAsync(string parish, ParishStatusActionDto request, CancellationToken ct)
    {
        var root = await BishopAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "parish-status:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return await WithOutcomeAsync(parish, (await ReadAsync(parish, prior.Id, ct)).Value, ct);
        var from = root.Value.Status;
        var to = (request.Action, from) switch
        {
            ("suspend", ParishStatus.Verified) => ParishStatus.Suspended,
            ("reinstate", ParishStatus.Suspended) => ParishStatus.Verified,
            ("close", ParishStatus.Verified or ParishStatus.Suspended) => ParishStatus.Closed,
            _ => throw State("That change is not available while the parish is " + from + ".")
        };
        var change = new ParishStatusChange
        {
            Id = op.Id, ParishId = parish, Action = request.Action, From = from, To = to, Reason = Guard.Text(request.Reason, "Reason", 1000),
            By = actor.AccountId, At = op.At
        };
        root.Value.Status = to;
        var notice = notifications.StageRequired(parish, root.Value.OwnerAccountId, "parish.status", "Your parish's operating status has changed.", null,
            "parish-status:" + op.Id, "ParishOwner", parish, op.At);
        change.NotificationWorkIds = [((NotificationWork)notice.Value!).Id];
        await records.CommitAsync(Scope(parish), op, "parish." + request.Action, parish,
            [RecordChange.Replace("parish", "parish", root.Value, Versions.Require(request.Version)), RecordChange.Create("parishStatusChange:" + op.Id, "parishStatusChange", change),
             notice],
            new CommandResult { Id = op.Id, Status = to.ToString() }, ct);
        await notifications.DispatchAsync(parish, root.Value.OwnerAccountId, "parish-status:" + op.Id, ct);
        return await WithOutcomeAsync(parish, change, ct);
    }

    // Only the jurisdiction bishop who may read this history sees whether the owner's in-app notice was stored; Stored is not reading.
    public async Task<NotificationOutcomeDto> NotificationOutcomeAsync(string parish, string change, CancellationToken ct)
    {
        await BishopAsync(parish, ct);
        return await outcomes.ReadAsync(parish, (await ReadAsync(parish, change, ct)).Value.NotificationWorkIds, ct);
    }

    private async Task<Versioned<ParishStatusChange>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<ParishStatusChange>(Scope(parish), "parishStatusChange:" + id, ct) is { } row && row.Value.Id == id && row.Value.ParishId == parish
            ? row : throw new DomainException("resource_not_found", "The requested status change is unavailable.", FailureKind.NotFound);

    private async Task<ParishStatusChangeDto> WithOutcomeAsync(string parish, ParishStatusChange change, CancellationToken ct)
    {
        var result = Project(change);
        result.NotificationOutcome = await outcomes.ReadAsync(parish, change.NotificationWorkIds, ct);
        return result;
    }

    public async Task<IReadOnlyList<ParishStatusChangeDto>> HistoryAsync(string parish, CancellationToken ct)
    {
        await BishopAsync(parish, ct);
        return (await records.CollectAsync<ParishStatusChange>(Scope(parish), "parishStatusChange", ct, 500))
            .Select(r => Project(r.Value)).OrderBy(c => c.At).ToArray();
    }

    private static ParishStatusChangeDto Project(ParishStatusChange x)
        => new() { Id = x.Id, Action = x.Action, From = x.From, To = x.To, Reason = x.Reason, By = x.By, At = x.At };
}
