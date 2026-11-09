// Purpose: stores confidential departure reasons with purpose-bound encryption and an atomic application fence.
// Main functions: SaveAsync and GetAsync enforce applicant/priest access; Protector and View keep plaintext out of receipts, audit and general records.

using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public class MinistryDepartureService(IRecordTransactions records, MinistryAccess access, MinistryApplicationService applications,
    ICurrentActor actor, IDataProtectionProvider protection, TimeProvider clock)
{
    public async Task<PrivateDepartureDto> SaveAsync(string parish, string ministry, string id, PrivateDepartureReasonDto request, CancellationToken ct)
    {
        await access.PersonalAsync(ct);
        var root = await access.RootAsync(parish, ct);
        var application = await applications.ReadAuthorizedAsync(parish, ministry, id, ct);
        if (application.Value.Kind != "Leave" || application.Value.ApplicantAccountId != actor.AccountId) throw MinistryAccess.Missing();
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-private-reason:v2:" + ministry + ":" + id);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null) return (await GetAsync(parish, ministry, id, ct)).Value;
        if (application.Value.Status is not ("AwaitingPriest" or "WithdrawalRequested"))
            throw MinistryAccess.State("The departure has ended; its reason can no longer be changed.");
        var key = "ministryPrivateReason:" + id;
        var old = await records.ReadAsync<MinistryPrivateReason>(scope, key, ct);
        var value = new MinistryPrivateReason
        {
            Id = id, ParishId = parish, MinistryId = ministry, ApplicationId = id, ApplicantAccountId = actor.AccountId,
            ProtectedReason = Protector(parish, ministry, id, actor.AccountId).Protect(Guard.Text(request.Reason, "Private reason", 2000)), RecordedAt = op.At
        };
        await records.CommitAsync(scope, op, "ministry.restricted_record_update", id,
            [MinistryAccess.Fence(root), RecordChange.Replace("ministryApplication:" + id, "ministryApplication", application.Value, application.Version),
                old is null ? RecordChange.Create(key, "ministryPrivateReason", value)
                    : RecordChange.Replace(key, "ministryPrivateReason", value, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = "Recorded" }, ct);
        return (await GetAsync(parish, ministry, id, ct)).Value;
    }
    public async Task<Versioned<PrivateDepartureDto>> GetAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var application = await applications.ReadAuthorizedAsync(parish, ministry, id, ct);
        if (application.Value.Kind != "Leave") throw MinistryAccess.Missing();
        var row = await records.ReadAsync<MinistryPrivateReason>(MinistryAccess.Scope(parish), "ministryPrivateReason:" + id, ct) ?? throw MinistryAccess.Missing();
        if (row.Value.ParishId != parish || row.Value.MinistryId != ministry || row.Value.ApplicationId != id
            || row.Value.ApplicantAccountId != application.Value.ApplicantAccountId) throw MinistryAccess.Missing();
        try
        {
            return new() { Version = row.Version, Value = new PrivateDepartureDto
            { ApplicationId = id, RecordedAt = row.Value.RecordedAt, Reason = Protector(parish, ministry, id, row.Value.ApplicantAccountId).Unprotect(row.Value.ProtectedReason) } };
        }
        catch (CryptographicException) { throw new DomainException("private_record_unavailable", "The protected record cannot currently be read.", FailureKind.Unavailable); }
    }
    private IDataProtector Protector(string parish, string ministry, string id, string account)
        => protection.CreateProtector("ParishLife.MinistryDeparture.v1", parish, ministry, id, account);
}
