// Purpose: lets a current MFA parish manager record, correct or clear the parish's verified map coordinates with their source. Maps show only
// these recorded coordinates; nothing is geocoded or guessed from a name or locality.
// Main functions: GetAsync and SetAsync (versioned, idempotent); Project shapes the manager view.

using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Organizations;

public class ParishLocationService(IRecordTransactions records, IParishAccess access, MfaAccountAccess proof, ICurrentActor actor, TimeProvider clock)
{
    internal const string Key = "location";
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };

    private async Task RequireAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await access.RequireAsync(parish, Permissions.ParishManage, ct);
    }

    public async Task<Versioned<ParishLocationDto>> GetAsync(string parish, CancellationToken ct)
    {
        await RequireAsync(parish, ct);
        var row = await records.ReadAsync<ParishLocation>(Scope(parish), Key, ct)
            ?? throw new DomainException("resource_not_found", "No location has been recorded for this parish.", FailureKind.NotFound);
        return new Versioned<ParishLocationDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<Versioned<ParishLocationDto>> SetAsync(string parish, SetParishLocationDto request, CancellationToken ct)
    {
        await RequireAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "parish-location:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await GetAsync(parish, ct);
        if (request.Latitude is null != request.Longitude is null)
            throw new DomainException("invalid_input", "Give latitude and longitude together, or neither to clear the location.");
        if (request.Latitude is < -90 or > 90 || request.Longitude is < -180 or > 180)
            throw new DomainException("invalid_input", "Latitude must be within -90..90 and longitude within -180..180.");
        var value = new ParishLocation
        {
            ParishId = parish, Latitude = request.Latitude, Longitude = request.Longitude, RecordedBy = actor.AccountId, RecordedAt = op.At,
            SourceReference = request.Latitude is null ? null : Guard.Text(request.SourceReference, "Source of the verified coordinates", 500)
        };
        var previous = await records.ReadAsync<ParishLocation>(Scope(parish), Key, ct);
        if (previous is null && request.Version is not null || previous is not null && previous.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The parish location changed; reload it before saving.", FailureKind.Conflict);
        await RequireAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, value.IsRecorded() ? "parish.location_recorded" : "parish.location_cleared", parish,
            [previous is null ? RecordChange.Create(Key, "parishLocation", value) : RecordChange.Replace(Key, "parishLocation", value, previous.Version)],
            new CommandResult { Id = parish, Status = value.IsRecorded() ? "Recorded" : "NotRecorded" }, ct);
        return await GetAsync(parish, ct);
    }

    internal static ParishLocationDto Project(ParishLocation value) => new()
    {
        ParishId = value.ParishId, Status = value.IsRecorded() ? "Recorded" : "NotRecorded", Latitude = value.Latitude, Longitude = value.Longitude,
        SourceReference = value.SourceReference, RecordedBy = value.RecordedBy, RecordedAt = value.RecordedAt
    };
}
