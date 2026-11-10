// Purpose: enforces current ministry, office, priest and personal boundaries without merging selected roles.
// Main functions: OfficeAsync, PriestAsync, LeaderAsync, ReaderAsync, RequireAttendanceAsync, RequireFormationAsync, RequireCustodyAsync, RequireCoordinatorAsync, IsCurrentMemberAsync, PersonalAsync, OwnLinkAsync and RootAsync; Scope, Fence and MemberKey identify atomic parish records.

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Ministries;

public class MinistryAccess(IRecordTransactions records, IParishRepository parishes, IParishAccess access,
    ICurrentActor actor, IClergyAuthority clergy, MfaAccountAccess proof, UserManager<ParishUser> users, TimeProvider clock)
{
    internal static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    internal static string MemberKey(string ministry, string person) => "ministryMembership:" + ministry + ":" + person;
    internal static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    internal static DomainException Missing() => new("resource_not_found", "The requested ministry resource is unavailable.", FailureKind.NotFound);
    internal static DomainException State(string message) => new("invalid_ministry_state", message, FailureKind.Conflict);
    internal Task ModuleAsync(string parish, CancellationToken ct) => access.RequireModuleAsync(parish, "ministries", ct);

    internal async Task<Versioned<Parish>> RootAsync(string parish, CancellationToken ct)
    {
        var row = await parishes.GetAsync(parish, ct) ?? throw Missing();
        if (row.Value.Status != ParishStatus.Verified) throw Missing();
        return row;
    }
    internal async Task<Versioned<Ministry>> ReadAsync(string parish, string ministry, CancellationToken ct)
    {
        var row = await records.ReadAsync<Ministry>(Scope(parish), "ministry:" + ministry, ct) ?? throw Missing();
        if (row.Value.ParishId != parish || row.Value.Id != ministry) throw Missing();
        return row;
    }
    internal async Task<Versioned<Parish>> OfficeAsync(string parish, CancellationToken ct, bool requireModule = true)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.MinistriesManage, ct);
        if (root.Value.Status != ParishStatus.Verified) throw Missing();
        if (requireModule) await ModuleAsync(parish, ct);
        return root;
    }
    internal async Task<Versioned<Parish>> PriestAsync(string parish, CancellationToken ct, bool requireModule = true)
    {
        var root = await OfficeAsync(parish, ct, requireModule);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        return root;
    }
    internal async Task<Versioned<Ministry>> LeaderAsync(string parish, string ministry, CancellationToken ct, bool requireModule = true)
    {
        await proof.RequireMfaAsync(ct);
        await RootAsync(parish, ct);
        if (actor.ActingAppointmentId is not null) await PriestAsync(parish, ct, requireModule);
        else
        {
            var grant = await parishes.GetGrantAsync(parish, actor.AccountId, ct);
            if (grant?.Denies.Contains(Permissions.MinistriesManage, StringComparer.Ordinal) == true) throw Missing();
            var appointment = await records.ReadAsync<MinistryLeader>(Scope(parish), "ministryLeader:" + ministry + ":" + actor.AccountId, ct);
            if (appointment?.Value.Current(clock.GetUtcNow()) != true || appointment.Value.MinistryId != ministry
                || appointment.Value.AccountId != actor.AccountId || appointment.Value.Role is not ("Leader" or "Assistant")) throw Missing();
            if (requireModule) await ModuleAsync(parish, ct);
        }
        return await ReadAsync(parish, ministry, ct);
    }
    internal async Task<Versioned<Ministry>> ReaderAsync(string parish, string ministry, CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
        {
            await OfficeAsync(parish, ct, false);
            return await ReadAsync(parish, ministry, ct);
        }
        try { await OfficeAsync(parish, ct, false); return await ReadAsync(parish, ministry, ct); }
        catch (DomainException error) when (error.Kind == FailureKind.NotFound) { }
        return await LeaderAsync(parish, ministry, ct, false);
    }
    internal Task<Versioned<Ministry>> RequireAttendanceAsync(string parish, string ministry, CancellationToken ct,
        bool review = false, bool requireModule = true, bool readOnly = false)
        => RequireDutyAsync(parish, ministry, ct, (Permissions.MinistriesAttendanceRecord, "attendance.record"),
            (Permissions.MinistriesAttendanceReview, "attendance.review"), review, requireModule, readOnly);

    // Formation recording (instructor/coordinator) and qualified review are separate explicit duties, like attendance.
    internal Task<Versioned<Ministry>> RequireFormationAsync(string parish, string ministry, CancellationToken ct,
        bool review = false, bool readOnly = false)
        => RequireDutyAsync(parish, ministry, ct, (Permissions.MinistriesFormationRecord, "formation.record"),
            (Permissions.MinistriesFormationReview, "formation.review"), review, !readOnly, readOnly);

    // Custody of physical group belongings is its own explicit duty; it grants no formation, attendance or private-reason access.
    internal Task<Versioned<Ministry>> RequireCustodyAsync(string parish, string ministry, CancellationToken ct, bool readOnly = false)
        => RequireDutyAsync(parish, ministry, ct, (Permissions.MinistriesResourcesManage, "resources.custody"),
            (Permissions.MinistriesResourcesManage, "resources.custody"), false, !readOnly, readOnly);

    // Volunteer coordination (opportunities, confirmations, hours review) is its own explicit duty.
    internal Task<Versioned<Ministry>> RequireCoordinatorAsync(string parish, string ministry, CancellationToken ct, bool readOnly = false)
        => RequireDutyAsync(parish, ministry, ct, (Permissions.MinistriesVolunteersManage, "volunteers.coordinate"),
            (Permissions.MinistriesVolunteersManage, "volunteers.coordinate"), false, !readOnly, readOnly);

    private async Task<Versioned<Ministry>> RequireDutyAsync(string parish, string ministry, CancellationToken ct,
        (string Permission, string Duty) record, (string Permission, string Duty) reviewer, bool review, bool requireModule, bool readOnly)
    {
        var group = await LeaderAsync(parish, ministry, ct, requireModule);
        var permissions = readOnly ? new[] { record.Permission, reviewer.Permission }
            : new[] { review ? reviewer.Permission : record.Permission };
        if (actor.ActingAppointmentId is not null)
        {
            foreach (var permission in permissions)
            {
                try { await access.RequireAsync(parish, permission, ct); return group; }
                catch (DomainException error) when ((error.Kind is FailureKind.NotFound or FailureKind.Forbidden) && readOnly) { }
            }
            throw Missing();
        }
        var leader = await records.ReadAsync<MinistryLeader>(Scope(parish), "ministryLeader:" + ministry + ":" + actor.AccountId, ct);
        var grant = await parishes.GetGrantAsync(parish, actor.AccountId, ct);
        if (leader is null || !leader.Value.Current(clock.GetUtcNow())) throw Missing();
        foreach (var permission in permissions)
        {
            var duty = permission == reviewer.Permission ? reviewer.Duty : record.Duty;
            if (leader.Value.Duties?.Contains(duty, StringComparer.Ordinal) == true
                && grant?.Denies.Contains(permission, StringComparer.Ordinal) != true) return group;
        }
        throw Missing();
    }

    internal async Task<Versioned<Ministry>> RequireRsvpReasonReaderAsync(string parish, string ministry, CancellationToken ct)
    {
        var group = await LeaderAsync(parish, ministry, ct, requireModule: false);
        if (actor.ActingAppointmentId is not null)
        {
            await access.RequireAsync(parish, Permissions.MinistriesRsvpPrivateRead, ct);
            return group;
        }
        var leader = await records.ReadAsync<MinistryLeader>(Scope(parish), "ministryLeader:" + ministry + ":" + actor.AccountId, ct);
        var grant = await parishes.GetGrantAsync(parish, actor.AccountId, ct);
        if (leader?.Value.Current(clock.GetUtcNow()) != true || leader.Value.Duties?.Contains("rsvp.private.read", StringComparer.Ordinal) != true
            || grant?.Denies.Contains(Permissions.MinistriesRsvpPrivateRead, StringComparer.Ordinal) == true) throw Missing();
        return group;
    }

    // Shared membership rule for new member work (formation, loans): a current period and an unarchived parish Person.
    internal async Task<bool> IsCurrentMemberAsync(string parish, string ministry, string person, DateTimeOffset at, CancellationToken ct)
    {
        var member = await records.ReadAsync<MinistryMembership>(Scope(parish), MemberKey(ministry, person), ct);
        var row = await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct);
        return member is not null && member.Value.MinistryId == ministry && member.Value.PersonId == person && member.Value.Current(at)
            && row is not null && !row.Value.Archived && row.Value.ParishId == parish;
    }

    internal async Task PersonalAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || proof.RecoverySession) throw Missing();
        if (await users.IsLockedOutAsync(await proof.CurrentAsync(ct))) throw Missing();
    }
    internal async Task<Versioned<PersonAccountLink>> OwnLinkAsync(string parish, CancellationToken ct)
    {
        await PersonalAsync(ct);
        await RootAsync(parish, ct);
        var link = await records.ReadAsync<PersonAccountLink>(Scope(parish), "personAccountLink:" + actor.AccountId, ct);
        if (link?.Value.Active != true || link.Value.AccountId != actor.AccountId || link.Value.ParishId != parish) throw Missing();
        var claim = await records.ReadAsync<CommandResult>(Scope(parish), "personAccountClaim:" + link.Value.PersonId, ct);
        var person = await records.ReadAsync<Person>(Scope(parish), "person:" + link.Value.PersonId, ct);
        if (claim?.Value.Id != actor.AccountId || claim.Value.Status != "Linked" || person?.Value.Archived != false || person.Value.ParishId != parish) throw Missing();
        return link;
    }
}
