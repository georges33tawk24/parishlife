// Purpose: once the office has accepted a request, opens the downstream record it needs through the existing services and links it:
// a sacramental case (SacramentService.CreateAsync) for a sacrament inquiry, or a certificate (CertificateService.CreateAsync) for a
// certificate request. Those services keep their own authority (sacraments.record, MFA, sacraments coverage); request access alone
// opens nothing. No register entry is made: a sacramental case starts at Received and is registered only by a priest later.
// Main functions: OpenAsync; Derive turns the caller's operation id into stable child operation ids so a retry neither duplicates the
// record nor the link.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Sacraments;

namespace ParishLife.Api.Services.Requests;

public class RequestRecordService(IRecordTransactions records, IParishAccess access, MfaAccountAccess proof, SacramentService sacraments,
    CertificateService certificates, RequestService requests)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException Missing() => new("resource_not_found", "The requested case is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_request_state", message, FailureKind.Conflict);

    public async Task<OpenedRequestRecordDto> OpenAsync(string parish, string id, OpenRequestRecordDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await access.RequireAsync(parish, Permissions.RequestsManage, ct);
        await access.RequireModuleAsync(parish, "requests", ct);
        var row = await records.ReadAsync<ParishRequest>(Scope(parish), "request:" + id, ct);
        if (row is null || row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        var sacramental = request.RecordKind == "SacramentalCase";
        var linkKind = sacramental ? "SacramentRecord" : "Certificate";
        var recordOperation = Derive(request.OperationId, "record");
        var recordId = recordOperation.ToString("N");
        var exists = sacramental
            ? await records.ReadAsync<SacramentRecord>(Scope(parish), "sacrament:" + recordId, ct) is not null
            : await records.ReadAsync<Certificate>(Scope(parish), "certificate:" + recordId, ct) is not null;
        var item = row.Value;
        if (!exists)
        {
            // First attempt: the office saw the current case, which is accepted, of the matching kind and matched to a parish person.
            if (Versions.Require(request.Version) != row.Version)
                throw new DomainException("write_conflict", "The current version or unique identifier changed.", FailureKind.Conflict);
            if (item.Status != "AcceptedForProcessing")
                throw State("Accept the request before opening its record.");
            if (item.Kind != (sacramental ? "SacramentInquiry" : "Certificate"))
                throw State(sacramental ? "Only a sacrament inquiry opens a sacramental case." : "Only a certificate request opens a certificate.");
            if (item.SubjectPersonId is null)
                throw State("Match the request to the subject's person record first.");
        }
        var subject = Guid.ParseExact(item.SubjectPersonId ?? throw State("Match the request to the subject's person record first."), "N");
        var requestId = Guid.ParseExact(id, "N");
        string status;
        if (sacramental)
        {
            var created = await sacraments.CreateAsync(parish, new CreateSacramentDto
            {
                OperationId = recordOperation, Sacrament = request.Sacrament, SubjectPersonId = subject, RequestId = requestId,
                Facts = request.Facts ?? new Dictionary<string, string>(), TentativeDate = request.TentativeDate
            }, ct);
            (recordId, status) = (created.Id, created.Status);
        }
        else
        {
            var created = await certificates.CreateAsync(parish, new CreateCertificateDto
            {
                OperationId = recordOperation, Sacrament = request.Sacrament, SubjectPersonId = subject, SourceRecordId = request.SourceRecordId,
                RequestId = requestId, Language = request.Language, Quantity = request.Quantity, Purpose = request.Purpose
            }, ct);
            (recordId, status) = (created.Id, created.Status);
        }
        var linked = await requests.LinkOpenedRecordAsync(parish, id, linkKind, recordId, Derive(request.OperationId, "link"), ct);
        return new OpenedRequestRecordDto { RecordKind = request.RecordKind, RecordId = recordId, RecordStatus = status, LinkKind = linkKind, Linked = linked };
    }

    // A stable, nonempty child operation id for the same caller operation.
    private static Guid Derive(Guid operation, string purpose)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes("request-record:v1:" + operation.ToString("N") + ":" + purpose))[..16];
        bytes[7] = (byte)((bytes[7] & 0x0F) | 0x80);
        bytes[8] = (byte)((bytes[8] & 0x3F) | 0x80);
        return new Guid(bytes);
    }
}
