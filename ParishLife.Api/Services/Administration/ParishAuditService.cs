// Purpose: the read-only parish audit trail for accounts holding audit.read in that parish: one bounded page of the audit rows that every
// committed parish operation writes (who, which action, which resource, when, in which selected appointment). Free-text reasons are not
// returned, and audit rows never contain request bodies, fingerprints or credentials. Finance and restricted-case partitions are not included.
// Main functions: PageAsync authorizes, pages and projects; Project maps the stored row to AuditEntryDto.

using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Administration;

public class ParishAuditService(IRecordTransactions records, IParishAccess access)
{
    public async Task<Page<AuditEntryDto>> PageAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await access.RequireAsync(parish, Permissions.AuditRead, ct);
        var page = await records.PageAsync<AuditRecord>(new RecordScope { Area = RecordArea.Parish, OwnerId = parish }, "audit", size, cursor, ct);
        return new Page<AuditEntryDto>
        {
            Items = page.Items.Select(r => Project(r.Value)).OrderByDescending(e => e.At).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    private static AuditEntryDto Project(AuditRecord value) => new()
    {
        OperationId = value.OperationId,
        ActorId = value.ActorId,
        Action = value.Action,
        ResourceId = value.ResourceId,
        At = value.At,
        ActingAppointmentId = value.ActingAppointmentId
    };
}
