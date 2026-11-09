// Purpose: appoints, hands over and ends evidenced ministry leadership with exact clergy authority and atomic parish fences.
// Main functions: AppointAsync, ChangeDutiesAsync, EndAsync, GetAsync, ListAsync and HistoryAsync; helpers enforce scope, eligibility and safe projections.

using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Ministries;

public class MinistryLeadershipService(IRecordTransactions records, IParishAccess access, IParishRepository parishes,
    ICurrentActor actor, IClergyAuthority clergy, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string ministry, string account) => "ministryLeader:" + ministry + ":" + account;
    private static DomainException Missing() => new("resource_not_found", "The requested ministry leadership is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_leadership_state", message, FailureKind.Conflict);

    public async Task<MinistryLeaderDto> AppointAsync(string parish, string ministry, AppointLeaderDto request, CancellationToken ct)
    {
        var root = await RequirePriestAsync(parish, ct);
        await access.RequireModuleAsync(parish, "ministries", ct);
        var account = Guard.Id(request.AccountId);
        var duties = await ValidateDutiesAsync(parish, request.Duties, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-leadership:v2:" + ministry + ":" + account);
        var group = await GroupAsync(parish, ministry, ct);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await CurrentAsync(parish, group.Value, account, true, ct);
        if (group.Value.Status != "Active" || request.Role is not ("Leader" or "Assistant"))
            throw State("An active ministry and a supported leadership role are required.");
        if (account == actor.AccountId)
            throw State("A different qualified priest must appoint this account.");
        Guard.Utc(request.StartsAt);
        if (request.EndsAt is { } end && (Guard.Utc(end) <= request.StartsAt || end <= op.At))
            throw State("The appointment end must follow its start and remain in the future.");
        var evidence = Guard.Text(request.EvidenceReference, "Appointment evidence", 1000);
        if (!await EligibleAsync(parish, account, ct))
            throw Missing();
        var old = await records.ReadAsync<MinistryLeader>(Scope(parish), Key(ministry, account), ct);
        if (old is not null && (!Matches(old.Value, ministry, account)
            || !old.Value.Revoked && old.Value.EndedAt is null && (old.Value.EndsAt is null || old.Value.EndsAt > op.At)))
            throw State("End the existing current or scheduled appointment before replacing it.");
        var item = new MinistryLeader
        {
            Id = op.Id,
            MinistryId = ministry,
            AccountId = account,
            Role = request.Role,
            Duties = duties,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            AppointedBy = actor.AccountId,
            AppointedAt = op.At,
            EvidenceReference = evidence,
            ReplacesAccountId = request.ReplaceAccountId is { } outgoingId ? Guard.Id(outgoingId) : null
        };
        var changes = new List<RecordChange>
        {
            RecordChange.Replace("parish", "parish", root.Value, root.Version),
            RecordChange.Replace("ministry:" + ministry, "ministry", group.Value, Versions.Require(request.MinistryVersion)),
            old is null ? RecordChange.Create(Key(ministry, account), "ministryLeader", item)
                : RecordChange.Replace(Key(ministry, account), "ministryLeader", item, old.Version),
            History(item, "Appointed", op, "incoming")
        };
        if (item.ReplacesAccountId is { } outgoing)
        {
            if (outgoing == account || request.StartsAt > op.At)
                throw State("A handover requires a different outgoing account and an immediately effective replacement.");
            var previous = await records.ReadAsync<MinistryLeader>(Scope(parish), Key(ministry, outgoing), ct) ?? throw Missing();
            if (!Matches(previous.Value, ministry, outgoing) || !previous.Value.Current(op.At))
                throw State("The outgoing leadership appointment is no longer current.");
            End(previous.Value, op, "Leadership handover");
            changes.Add(RecordChange.Replace(Key(ministry, outgoing), "ministryLeader", previous.Value, Versions.Require(request.ReplaceVersion)));
            changes.Add(History(previous.Value, "HandedOver", op, "outgoing"));
        }
        else if (request.ReplaceVersion is not null)
            throw State("An outgoing version requires an outgoing account.");

        // Recheck cross-partition identity and current office immediately before the conditional parish batch.
        await RequirePriestAsync(parish, ct);
        if (!await EligibleAsync(parish, account, ct))
            throw Missing();
        await records.CommitAsync(Scope(parish), op, "ministry.leadership_appoint", ministry, changes,
            new CommandResult { Id = account, Status = "Recorded" }, ct);
        return await CurrentAsync(parish, (await GroupAsync(parish, ministry, ct)).Value, account, true, ct);
    }

    public async Task<MinistryLeaderDto> ChangeDutiesAsync(string parish, string ministry, string account, ChangeMinistryLeaderDutiesDto request, CancellationToken ct)
    {
        var root = await RequirePriestAsync(parish, ct);
        var duties = await ValidateDutiesAsync(parish, request.Duties, ct, authorize: false);
        var group = await GroupAsync(parish, ministry, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-leadership-duties:v1:" + ministry + ":" + account);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await CurrentAsync(parish, group.Value, account, true, ct);
        var row = await records.ReadAsync<MinistryLeader>(Scope(parish), Key(ministry, account), ct) ?? throw Missing();
        if (account == actor.AccountId || !Matches(row.Value, ministry, account) || !row.Value.Current(op.At))
            throw State("A different qualified priest must review a current leader's duties.");
        var priorDuties = row.Value.Duties ?? [];
        var additions = duties.Except(priorDuties, StringComparer.Ordinal).ToArray();
        foreach (var duty in additions)
            await access.RequireAsync(parish, DutyPermission(duty), ct);
        if (additions.Length > 0)
        {
            await access.RequireModuleAsync(parish, "ministries", ct);
            if (group.Value.Status != "Active" || !await EligibleAsync(parish, account, ct)) throw Missing();
        }
        var evidence = Guard.Text(request.EvidenceReference, "Actual duty review reference", 1000);
        Guard.Text(request.Reason, "Duty review reason", 2000);
        row.Value.Duties = duties;
        // The actual review reference and reason remain in the protected operational history, not receipt/audit text.
        var change = new MinistryLeadershipHistory
        {
            Id = op.Id + ":duties", MinistryId = ministry, AccountId = account, Action = "DutiesChanged",
            RecordedBy = actor.AccountId, RecordedAt = op.At, Appointment = row.Value,
            EvidenceReference = evidence, Reason = request.Reason.Trim()
        };
        await RequirePriestAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, "ministry.leadership_duties", ministry,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version),
                RecordChange.Replace("ministry:" + ministry, "ministry", group.Value, group.Version),
                RecordChange.Replace(Key(ministry, account), "ministryLeader", row.Value, Versions.Require(request.Version)),
                RecordChange.Create("ministryLeadershipChange:" + change.Id, "ministryLeadershipChange", change)],
            new CommandResult { Id = account, Status = "Recorded" }, ct);
        return await CurrentAsync(parish, group.Value, account, true, ct);
    }

    public async Task<MinistryLeaderDto> EndAsync(string parish, string ministry, string account, EndMinistryLeaderDto request, CancellationToken ct)
    {
        var root = await RequirePriestAsync(parish, ct);
        var group = await GroupAsync(parish, ministry, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-leadership-end:v2:" + ministry + ":" + account);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await CurrentAsync(parish, group.Value, account, true, ct);
        var row = await records.ReadAsync<MinistryLeader>(Scope(parish), Key(ministry, account), ct) ?? throw Missing();
        if (!Matches(row.Value, ministry, account))
            throw Missing();
        if (row.Value.Revoked || row.Value.EndedAt is not null)
            throw State("This appointment has already ended.");
        End(row.Value, op, Guard.Text(request.Reason, "Ending reason", 2000));
        await RequirePriestAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, "ministry.leadership_end", ministry,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version),
             RecordChange.Replace("ministry:" + ministry, "ministry", group.Value, group.Version),
             RecordChange.Replace(Key(ministry, account), "ministryLeader", row.Value, Versions.Require(request.Version)),
             History(row.Value, "Ended", op, "ended")], new CommandResult { Id = account, Status = "Recorded" }, ct);
        return await CurrentAsync(parish, (await GroupAsync(parish, ministry, ct)).Value, account, true, ct);
    }

    public async Task<Versioned<MinistryLeaderDto>> GetAsync(string parish, string ministry, string account, CancellationToken ct)
    {
        var group = await GroupAsync(parish, ministry, ct);
        var privileged = await RequireReaderAsync(parish, group.Value, ct);
        var row = await records.ReadAsync<MinistryLeader>(Scope(parish), Key(ministry, account), ct) ?? throw Missing();
        if (!Matches(row.Value, ministry, account))
            throw Missing();
        return new Versioned<MinistryLeaderDto>
        {
            Version = row.Version,
            Value = Project(row.Value, privileged, group.Value.Status == "Active" && row.Value.Current(clock.GetUtcNow())
                && await EligibleAsync(parish, account, ct))
        };
    }

    public async Task<Page<Versioned<MinistryLeaderDto>>> ListAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        var group = await GroupAsync(parish, ministry, ct);
        await RequireReaderAsync(parish, group.Value, ct);
        var page = await records.PageAsync<MinistryLeader>(Scope(parish), "ministryLeader", size, cursor, ct,
            new RecordCondition { Path = "ministryId", Comparison = "eq", Value = ministry });
        var rows = new List<Versioned<MinistryLeaderDto>>();
        foreach (var row in page.Items)
            rows.Add(new Versioned<MinistryLeaderDto>
            {
                Version = row.Version,
                Value = Project(row.Value, false, group.Value.Status == "Active" && row.Value.Current(clock.GetUtcNow())
                    && await EligibleAsync(parish, row.Value.AccountId, ct))
            });
        return new Page<Versioned<MinistryLeaderDto>> { Items = rows, ContinuationToken = page.ContinuationToken };
    }

    public async Task<Page<MinistryLeadershipHistoryDto>> HistoryAsync(string parish, string ministry, string account,
        int size, string? cursor, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await access.RequireAsync(parish, Permissions.MinistriesManage, ct);
        await GroupAsync(parish, ministry, ct);
        var page = await records.PageAsync<MinistryLeadershipHistory>(Scope(parish), "ministryLeadershipChange", size, cursor, ct,
            new RecordCondition { Path = "ministryId", Comparison = "eq", Value = ministry },
            new RecordCondition { Path = "accountId", Comparison = "eq", Value = account });
        return new Page<MinistryLeadershipHistoryDto>
        {
            Items = page.Items.Select(row => new MinistryLeadershipHistoryDto
            {
                Id = row.Value.Id,
                Action = row.Value.Action,
                RecordedAt = row.Value.RecordedAt,
                RecordedBy = row.Value.RecordedBy,
                EvidenceReference = row.Value.EvidenceReference,
                Reason = row.Value.Reason,
                // Historical snapshots are not assertions of current authority.
                Appointment = Project(row.Value.Appointment, true, false)
            }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    private async Task<Versioned<Parish>> RequirePriestAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.MinistriesManage, ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        return root;
    }

    private async Task<bool> RequireReaderAsync(string parish, Ministry group, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        if (actor.ActingAppointmentId is not null)
        {
            await access.RequireAsync(parish, Permissions.MinistriesManage, ct);
            return true;
        }
        var grant = await parishes.GetGrantAsync(parish, actor.AccountId, ct);
        if (grant?.Denies.Contains(Permissions.MinistriesManage, StringComparer.Ordinal) == true)
            throw Missing();
        if (grant?.Permits(Permissions.MinistriesManage, clock.GetUtcNow()) == true)
        {
            await access.RequireAsync(parish, Permissions.MinistriesManage, ct);
            return true;
        }
        var root = await parishes.GetAsync(parish, ct);
        var own = await records.ReadAsync<MinistryLeader>(Scope(parish), Key(group.Id, actor.AccountId), ct);
        if (root?.Value.Status != ParishStatus.Verified || group.Status != "Active"
            || own is null || !Matches(own.Value, group.Id, actor.AccountId) || !own.Value.Current(clock.GetUtcNow())
            || own.Value.Role is not ("Leader" or "Assistant"))
            throw Missing();
        return false;
    }

    private async Task<bool> EligibleAsync(string parish, string account, CancellationToken ct)
        => await proof.IsVerifiedMfaAccountAsync(account, ct)
        && (await parishes.GetGrantAsync(parish, account, ct))?.Denies.Contains(Permissions.MinistriesManage, StringComparer.Ordinal) != true;

    private async Task<Versioned<Ministry>> GroupAsync(string parish, string ministry, CancellationToken ct)
    {
        var group = await records.ReadAsync<Ministry>(Scope(parish), "ministry:" + ministry, ct) ?? throw Missing();
        if (group.Value.Id != ministry || group.Value.ParishId != parish)
            throw Missing();
        return group;
    }

    private async Task<MinistryLeaderDto> CurrentAsync(string parish, Ministry group, string account, bool privileged, CancellationToken ct)
    {
        var row = await records.ReadAsync<MinistryLeader>(Scope(parish), Key(group.Id, account), ct) ?? throw Missing();
        if (!Matches(row.Value, group.Id, account))
            throw Missing();
        return Project(row.Value, privileged, group.Status == "Active" && row.Value.Current(clock.GetUtcNow())
            && await EligibleAsync(parish, account, ct));
    }

    private void End(MinistryLeader item, Operation operation, string reason)
    {
        item.Revoked = true;
        item.EndedAt = operation.At;
        item.EndedBy = actor.AccountId;
        item.EndReason = reason;
        // A cancelled future appointment keeps its planned interval; EndedAt records the actual cancellation.
        if (item.StartsAt <= operation.At && (item.EndsAt is null || item.EndsAt > operation.At))
            item.EndsAt = operation.At;
    }

    private RecordChange History(MinistryLeader item, string action, Operation operation, string suffix)
    {
        var id = operation.Id + ":" + suffix;
        return RecordChange.Create("ministryLeadershipChange:" + id, "ministryLeadershipChange", new MinistryLeadershipHistory
        {
            Id = id,
            MinistryId = item.MinistryId,
            AccountId = item.AccountId,
            Action = action,
            RecordedBy = actor.AccountId,
            RecordedAt = operation.At,
            Appointment = item
        });
    }

    private async Task<string[]> ValidateDutiesAsync(string parish, string[]? duties, CancellationToken ct, bool authorize = true)
    {
        if (duties is null || duties.Length > 3 || duties.Distinct(StringComparer.Ordinal).Count() != duties.Length
            || duties.Any(value => value is not ("attendance.record" or "attendance.review" or "rsvp.private.read")))
            throw State("Use distinct supported privacy/attendance duties; appointment alone grants neither access.");
        foreach (var duty in authorize ? duties : [])
            await access.RequireAsync(parish, DutyPermission(duty), ct);
        return duties.Order(StringComparer.Ordinal).ToArray();
    }

    private static string DutyPermission(string duty) => duty switch
    {
        "attendance.record" => Permissions.MinistriesAttendanceRecord,
        "attendance.review" => Permissions.MinistriesAttendanceReview,
        "rsvp.private.read" => Permissions.MinistriesRsvpPrivateRead,
        _ => throw State("Unsupported ministry duty.")
    };

    private static bool Matches(MinistryLeader item, string ministry, string account)
        => item.MinistryId == ministry && item.AccountId == account;

    private static MinistryLeaderDto Project(MinistryLeader item, bool privileged, bool effective) => new()
    {
        Id = item.Id,
        MinistryId = item.MinistryId,
        AccountId = item.AccountId,
        Role = item.Role,
        Duties = [.. item.Duties ?? []],
        StartsAt = item.StartsAt,
        EndsAt = item.EndsAt,
        Revoked = item.Revoked,
        Effective = effective,
        AppointedBy = item.AppointedBy,
        AppointedAt = item.AppointedAt,
        EndedAt = item.EndedAt,
        EndedBy = item.EndedBy,
        ReplacesAccountId = item.ReplacesAccountId,
        EvidenceReference = privileged ? item.EvidenceReference : null,
        EndReason = privileged ? item.EndReason : null
    };
}
