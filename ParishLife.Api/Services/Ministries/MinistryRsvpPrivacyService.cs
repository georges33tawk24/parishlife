// Purpose: keeps optional confidential RSVP reasons separate from meeting content, public replies and attendance.
// Main functions: SaveAsync atomically sets/clears protected text; GetOwnAsync preserves original-author history; GetAsync requires an explicitly designated current reader.

using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public class MinistryRsvpPrivacyService(IRecordTransactions records, MinistryAccess access, ICurrentActor actor,
    IDataProtectionProvider protection, TimeProvider clock)
{
    public async Task<PrivateRsvpReasonDto> SaveAsync(string parish, string ministry, string meetingId, SaveRsvpReasonDto request, CancellationToken ct)
    {
        await access.PersonalAsync(ct);
        var root = await access.RootAsync(parish, ct);
        var group = await access.ReadAsync(parish, ministry, ct);
        var meeting = await ReadMeetingAsync(parish, ministry, meetingId, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-rsvp-private-reason:v1:" + ministry + ":" + meetingId);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return (await GetOwnAsync(parish, ministry, meetingId, ct)).Value;
        await access.ModuleAsync(parish, ct);
        if (group.Value.Status != "Active" || !EditWindow(meeting.Value))
            throw State("Private planning reasons can be changed only before the confirmed meeting's RSVP cutoff.");
        var link = await access.OwnLinkAsync(parish, ct);
        var personId = link.Value.PersonId;
        var membership = await MembershipAsync(parish, ministry, personId, meeting.Value.StartsAt, ct);
        var rsvp = await RsvpAsync(parish, ministry, meetingId, personId, actor.AccountId, ct);
        var person = await records.ReadAsync<Person>(scope, "person:" + personId, ct);
        var claim = await records.ReadAsync<CommandResult>(scope, "personAccountClaim:" + personId, ct);
        if (person?.Value is not { Archived: false } || person.Value.ParishId != parish || person.Value.Id != personId
            || claim?.Value.Id != actor.AccountId || claim.Value.Status != "Linked") throw MinistryAccess.Missing();
        var key = ReasonKey(meetingId, personId);
        var ownerKey = OwnerKey(meetingId, actor.AccountId);
        var previous = await records.ReadAsync<MinistryRsvpReason>(scope, key, ct);
        var owner = await records.ReadAsync<CommandResult>(scope, ownerKey, ct);
        if (owner is not null && (owner.Value.Id != personId || owner.Value.Status != "Recorded"))
            throw State("An existing private reason's original identity needs reviewed correction before a new author binding.");
        if (previous is not null && !Matches(previous.Value, parish, ministry, meetingId, personId, actor.AccountId)) throw MinistryAccess.Missing();
        if (previous is not null && owner is null) throw State("The private record's original-author binding requires review.");
        if (request.Clear && (!string.IsNullOrWhiteSpace(request.Reason) || previous is null || previous.Value.Cleared))
            throw State("Clear an existing reason explicitly, without supplying replacement text.");
        var reason = request.Clear ? null : Guard.Text(request.Reason, "Private RSVP reason", 2000);
        var value = new MinistryRsvpReason
        {
            Id = meetingId + ":" + personId, ParishId = parish, MinistryId = ministry, MeetingId = meetingId,
            PersonId = personId, AccountId = actor.AccountId, RecordedAt = op.At, RevisionId = op.Id,
            Cleared = request.Clear, ProtectedReason = reason is null ? null : Protector(parish, ministry, meetingId, personId, actor.AccountId).Protect(reason)
        };
        var revision = new MinistryRsvpReasonRevision
        {
            Id = op.Id, ParishId = parish, MinistryId = ministry, MeetingId = meetingId, PersonId = personId,
            AccountId = actor.AccountId, RecordedBy = actor.AccountId, RecordedAt = op.At,
            Action = request.Clear ? "clear" : "set", PreviousRevisionId = previous?.Value.RevisionId, ProtectedReason = value.ProtectedReason
        };
        var occurrence = await records.ReadAsync<CalendarEvent>(scope, "event:" + meeting.Value.EventId, ct) ?? throw MinistryAccess.Missing();
        var changes = new List<RecordChange>
        {
            MinistryAccess.Fence(root),
            RecordChange.Replace("ministry:" + ministry, "ministry", group.Value, group.Version),
            RecordChange.Replace("ministryMeeting:" + meetingId, "ministryMeeting", meeting.Value, meeting.Version),
            RecordChange.Replace("event:" + meeting.Value.EventId, "event", occurrence.Value, occurrence.Version),
            RecordChange.Replace("personAccountLink:" + actor.AccountId, "personAccountLink", link.Value, link.Version),
            RecordChange.Replace("personAccountClaim:" + personId, "personAccountClaim", claim.Value, claim.Version),
            RecordChange.Replace("person:" + personId, "person", person.Value, person.Version),
            RecordChange.Replace(MinistryAccess.MemberKey(ministry, personId), "ministryMembership", membership.Value, membership.Version),
            RecordChange.Replace("meetingRsvp:" + meetingId + ":" + personId, "meetingRsvp", rsvp.Value, rsvp.Version),
            previous is null ? RecordChange.Create(key, "ministryRsvpReason", value)
                : RecordChange.Replace(key, "ministryRsvpReason", value, Versions.Require(request.Version)),
            owner is null ? RecordChange.Create(ownerKey, "ministryRsvpReasonOwner", new CommandResult { Id = personId, Status = "Recorded" })
                : RecordChange.Replace(ownerKey, "ministryRsvpReasonOwner", owner.Value, owner.Version),
            RecordChange.Create("ministryRsvpReasonRevision:" + op.Id, "ministryRsvpReasonRevision", revision)
        };
        // Recheck the account before the conditional parish batch; cross-account revocation remains a separate storage boundary.
        await access.PersonalAsync(ct);
        await records.CommitAsync(scope, op, "ministry.restricted_planning_record_update", meetingId, changes,
            new CommandResult { Id = meetingId, Status = "Recorded" }, ct);
        return (await GetOwnAsync(parish, ministry, meetingId, ct)).Value;
    }

    public async Task<Versioned<PrivateRsvpReasonDto>> GetOwnAsync(string parish, string ministry, string meetingId, CancellationToken ct)
    {
        await access.PersonalAsync(ct);
        await access.RootAsync(parish, ct);
        var group = await access.ReadAsync(parish, ministry, ct);
        var meeting = await ReadMeetingAsync(parish, ministry, meetingId, ct);
        var owner = await records.ReadAsync<CommandResult>(MinistryAccess.Scope(parish), OwnerKey(meetingId, actor.AccountId), ct);
        if (owner?.Value.Status != "Recorded") throw MinistryAccess.Missing();
        var row = await ReadReasonAsync(parish, ministry, meetingId, owner.Value.Id, ct);
        if (row.Value.AccountId != actor.AccountId) throw MinistryAccess.Missing();
        return new() { Value = View(row.Value, await CanEditAsync(parish, ministry, meeting.Value, group.Value, row.Value, ct)), Version = row.Version };
    }

    public async Task<Versioned<PrivateRsvpReasonDto>> GetAsync(string parish, string ministry, string meetingId, string personId, CancellationToken ct)
    {
        await access.RequireRsvpReasonReaderAsync(parish, ministry, ct);
        await ReadMeetingAsync(parish, ministry, meetingId, ct);
        var row = await ReadReasonAsync(parish, ministry, meetingId, personId, ct);
        return new() { Value = View(row.Value, false), Version = string.Empty };
    }

    private async Task<Versioned<MinistryRsvpReason>> ReadReasonAsync(string parish, string ministry, string meetingId, string personId, CancellationToken ct)
    {
        var row = await records.ReadAsync<MinistryRsvpReason>(MinistryAccess.Scope(parish), ReasonKey(meetingId, personId), ct) ?? throw MinistryAccess.Missing();
        if (!Matches(row.Value, parish, ministry, meetingId, personId, row.Value.AccountId) || string.IsNullOrEmpty(row.Value.AccountId)) throw MinistryAccess.Missing();
        return row;
    }

    private async Task<Versioned<MinistryMeeting>> ReadMeetingAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var scope = MinistryAccess.Scope(parish);
        var row = await records.ReadAsync<MinistryMeeting>(scope, "ministryMeeting:" + id, ct) ?? throw MinistryAccess.Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish || row.Value.MinistryId != ministry || row.Value.Visibility != "Ministry") throw MinistryAccess.Missing();
        var occurrence = await records.ReadAsync<CalendarEvent>(scope, "event:" + row.Value.EventId, ct);
        if (occurrence is null || occurrence.Value.ParishId != parish || occurrence.Value.Id != row.Value.EventId
            || occurrence.Value.SourceType != "MinistryMeeting" || occurrence.Value.SourceId != id || occurrence.Value.MinistryId != ministry
            || occurrence.Value.Visibility != "Ministry" || occurrence.Value.Kind != "MinistryMeeting" || occurrence.Value.Published
            || occurrence.Value.StartsAt != row.Value.StartsAt || occurrence.Value.EndsAt != row.Value.EndsAt || occurrence.Value.TimeZone != row.Value.TimeZone
            || occurrence.Value.Title != row.Value.Title || occurrence.Value.Status != row.Value.Status || occurrence.Value.ClergyAccountIds?.Length > 0)
            throw State("The meeting/calendar source requires review before private planning records can be used.");
        return row;
    }

    private async Task<Versioned<MinistryMembership>> MembershipAsync(string parish, string ministry, string personId, DateTimeOffset occurrence, CancellationToken ct)
    {
        var row = await records.ReadAsync<MinistryMembership>(MinistryAccess.Scope(parish), MinistryAccess.MemberKey(ministry, personId), ct);
        if (row is null || row.Value.MinistryId != ministry || row.Value.PersonId != personId
            || !row.Value.Current(clock.GetUtcNow()) || !row.Value.Current(occurrence)) throw MinistryAccess.Missing();
        return row;
    }

    private async Task<Versioned<MeetingRsvp>> RsvpAsync(string parish, string ministry, string meetingId, string personId, string account, CancellationToken ct)
    {
        var row = await records.ReadAsync<MeetingRsvp>(MinistryAccess.Scope(parish), "meetingRsvp:" + meetingId + ":" + personId, ct);
        if (row is null || row.Value.MinistryId != ministry || row.Value.MeetingId != meetingId || row.Value.PersonId != personId
            || row.Value.AccountId != account || row.Value.Response is not ("Yes" or "No" or "Undecided")) throw MinistryAccess.Missing();
        return row;
    }

    private async Task<bool> CanEditAsync(string parish, string ministry, MinistryMeeting meeting, Ministry group, MinistryRsvpReason value, CancellationToken ct)
    {
        if (group.Status != "Active" || !EditWindow(meeting)) return false;
        try
        {
            await access.ModuleAsync(parish, ct);
            var link = await access.OwnLinkAsync(parish, ct);
            if (link.Value.PersonId != value.PersonId || value.AccountId != actor.AccountId) return false;
            await MembershipAsync(parish, ministry, value.PersonId, meeting.StartsAt, ct);
            await RsvpAsync(parish, ministry, meeting.Id, value.PersonId, actor.AccountId, ct);
            return true;
        }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { return false; }
    }

    private bool EditWindow(MinistryMeeting value) => value.Status == "Confirmed" && value.RsvpMode is "Optional" or "Required"
        && value.StartsAt > clock.GetUtcNow() && value.RsvpDeadline is { } cutoff && cutoff <= value.StartsAt && cutoff > clock.GetUtcNow();

    private PrivateRsvpReasonDto View(MinistryRsvpReason value, bool canEdit)
    {
        string? reason = null;
        if (!value.Cleared)
        {
            if (string.IsNullOrWhiteSpace(value.ProtectedReason)) throw State("The protected planning record requires review.");
            try { reason = Protector(value.ParishId, value.MinistryId, value.MeetingId, value.PersonId, value.AccountId).Unprotect(value.ProtectedReason); }
            catch (CryptographicException) { throw new DomainException("private_record_unavailable", "The protected planning record could not be read.", FailureKind.Unavailable); }
        }
        return new() { MeetingId = value.MeetingId, PersonId = value.PersonId, Reason = reason, Cleared = value.Cleared, RecordedAt = value.RecordedAt, CanEdit = canEdit };
    }
    private IDataProtector Protector(string parish, string ministry, string meetingId, string personId, string account)
        => protection.CreateProtector("ParishLife.MinistryRsvpReason.v1", parish, ministry, meetingId, personId, account);
    private static bool Matches(MinistryRsvpReason value, string parish, string ministry, string meetingId, string personId, string account)
        => value.ParishId == parish && value.MinistryId == ministry && value.MeetingId == meetingId && value.PersonId == personId
        && value.AccountId == account && value.Id == meetingId + ":" + personId;
    private static string ReasonKey(string meetingId, string personId) => "ministryRsvpReason:" + meetingId + ":" + personId;
    private static string OwnerKey(string meetingId, string account) => "ministryRsvpReasonOwner:" + meetingId + ":" + account;
    private static DomainException State(string message) => new("invalid_rsvp_reason_state", message, FailureKind.Conflict);
}
