// Purpose: checks a durable notification recipient's current typed source audience without impersonating a browser user.
// Main functions: IsEligibleAsync checks exact applicants, linked self-registrants, certificate-request subjects and participants/owners;
// StaffAsync checks independent grants or accepted priest duties without combining capacities.

using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Communications;

public class NotificationAudience(IRecordTransactions records, IParishRepository parishes, IAccountDirectory accounts,
    MfaAccountAccess proof, TimeProvider clock)
{
    internal static readonly IReadOnlySet<string> Supported = new HashSet<string>(StringComparer.Ordinal)
    {
        "RequestApplicant", "RequestAssociation", "MembershipApplicant", "CorrectionApplicant", "ConcernApplicant",
        "InboxParticipant", "IncidentHandler", "InvitationIssuer", "ParishOwner", "RegistrationApplicant", "CertificateApplicant"
    };

    internal async Task<bool> IsEligibleAsync(NotificationWork work, CancellationToken ct)
    {
        if (!Supported.Contains(work.Audience) || !await accounts.IsActiveVerifiedAsync(work.AccountId, ct)) return false;
        var root = await parishes.GetAsync(work.ParishId, ct);
        if (root is null || root.Value.Id != work.ParishId) return false;
        // Operating-status changes must reach the actual owner even while the parish is suspended or closed.
        if (work.Audience == "ParishOwner")
            return work.ResourceId == work.ParishId && root.Value.OwnerAccountId == work.AccountId;
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = work.ParishId };
        switch (work.Audience)
        {
            case "RequestApplicant":
            {
                var source = (await records.ReadAsync<ParishRequest>(scope, "request:" + work.ResourceId, ct))?.Value;
                return source?.Id == work.ResourceId && source.ParishId == work.ParishId && source.ApplicantAccountId == work.AccountId;
            }
            case "RequestAssociation":
            {
                var source = (await records.ReadAsync<ParishRequest>(scope, "request:" + work.ResourceId, ct))?.Value;
                // The source transaction captured its historical claimant before clearing it. A generic, unlinked outcome notice
                // intentionally survives a declined claim; it grants neither case access nor a claim on the current applicant.
                return source?.Id == work.ResourceId && source.ParishId == work.ParishId
                    && (work.Link is null || source.ApplicantAccountId == work.AccountId);
            }
            case "MembershipApplicant":
            {
                var source = (await records.ReadAsync<MembershipRequest>(scope, "membershipRequest:" + work.ResourceId, ct))?.Value;
                return source?.Id == work.ResourceId && source.ParishId == work.ParishId && source.ApplicantAccountId == work.AccountId;
            }
            case "CorrectionApplicant":
            {
                var source = (await records.ReadAsync<ProfileCorrection>(scope, "profileCorrection:" + work.ResourceId, ct))?.Value;
                return source?.Id == work.ResourceId && source.ParishId == work.ParishId && source.ApplicantAccountId == work.AccountId;
            }
            case "ConcernApplicant":
            {
                var source = (await records.ReadAsync<Concern>(scope, "concern:" + work.ResourceId, ct))?.Value;
                return source?.Id == work.ResourceId && source.ParishId == work.ParishId && source.ApplicantAccountId == work.AccountId;
            }
            case "RegistrationApplicant":
            {
                var source = (await records.ReadAsync<EventRegistration>(scope, "registration:" + work.ResourceId, ct))?.Value;
                if (source?.Id != work.ResourceId || source.ParishId != work.ParishId || source.Origin != "Self"
                    || source.CreatedBy != work.AccountId || string.IsNullOrWhiteSpace(source.PersonId)
                    || root.Value.Status != ParishStatus.Verified) return false;
                var link = (await records.ReadAsync<PersonAccountLink>(scope, "personAccountLink:" + work.AccountId, ct))?.Value;
                if (link?.Active != true || link.ParishId != work.ParishId || link.AccountId != work.AccountId || link.PersonId != source.PersonId) return false;
                var claim = (await records.ReadAsync<CommandResult>(scope, "personAccountClaim:" + source.PersonId, ct))?.Value;
                var person = (await records.ReadAsync<Person>(scope, "person:" + source.PersonId, ct))?.Value;
                return claim?.Id == work.AccountId && claim.Status == "Linked" && person?.Archived == false
                    && person.Id == source.PersonId && person.ParishId == work.ParishId;
            }
            case "CertificateApplicant":
            {
                var source = (await records.ReadAsync<Certificate>(scope, "certificate:" + work.ResourceId, ct))?.Value;
                if (source?.Id != work.ResourceId || source.ParishId != work.ParishId || string.IsNullOrWhiteSpace(source.PersonId)
                    || source.RequestId is not { } requestId) return false;
                var request = (await records.ReadAsync<ParishRequest>(scope, "request:" + requestId, ct))?.Value;
                return request?.Id == requestId && request.ParishId == work.ParishId && request.ApplicantAccountId == work.AccountId
                    && request.SubjectPersonId == source.PersonId;
            }
            case "InboxParticipant":
            {
                var source = (await records.ReadAsync<Conversation>(scope, "conversation:" + work.ResourceId, ct))?.Value;
                if (source?.Id != work.ResourceId || source.ParishId != work.ParishId
                    || !source.ParticipantAccountIds.Contains(work.AccountId, StringComparer.Ordinal)) return false;
                return source.Kind == "Office" || source.Kind == "Direct"
                    && (source.CreatedBy != work.AccountId || await StaffAsync(root.Value, work.AccountId, Permissions.CommunicationsManage, null, ct));
            }
            case "IncidentHandler":
            {
                var source = (await records.ReadAsync<Incident>(scope, "incident:" + work.ResourceId, ct))?.Value;
                return source?.Id == work.ResourceId && source.ParishId == work.ParishId && source.HandlerAccountId == work.AccountId
                    && await StaffAsync(root.Value, work.AccountId, Permissions.IncidentsManage, "office", ct);
            }
            case "InvitationIssuer":
            {
                var source = (await records.ReadAsync<PersonInvitation>(scope, "personInvitation:" + work.ResourceId, ct))?.Value;
                return source?.Id == work.ResourceId && source.ParishId == work.ParishId && source.CreatedBy == work.AccountId
                    && await StaffAsync(root.Value, work.AccountId, Permissions.PeopleWrite, "office", ct);
            }
            default: return false;
        }
    }

    private async Task<bool> StaffAsync(Parish parish, string account, string permission, string? module, CancellationToken ct)
    {
        if (parish.Status is ParishStatus.Closed or ParishStatus.Suspended) return false;
        if (!await proof.IsVerifiedMfaAccountAsync(account, ct)) return false;
        var now = clock.GetUtcNow();
        if (module is not null && (parish.Status != ParishStatus.Verified
            || !(await parishes.GetCoveragesAsync(parish.Id, ct)).Any(coverage => coverage.Includes(module, now)))) return false;
        var grant = await parishes.GetGrantAsync(parish.Id, account, ct);
        if (grant?.Denies.Contains(permission, StringComparer.Ordinal) == true) return false;
        if (grant?.Permits(permission, now) == true) return true;
        if (parish.JurisdictionArchdioceseId is not { } archdiocese
            || (await parishes.GetArchdioceseAsync(archdiocese, ct))?.Value.Verified != true) return false;
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish.Id };
        var appointments = await records.CollectAsync<StaffAppointment>(scope, "staffAppointment", ct, 500,
            new RecordCondition { Path = "accountId", Comparison = "eq", Value = account });
        // One complete current capacity must permit this action; duties from different appointments are never combined.
        return appointments.Any(row => row.Value.AccountId == account && row.Value.ParishId == parish.Id
            && row.Value.Role == StaffAppointmentRole.Priest && row.Value.ArchdioceseId == archdiocese && row.Value.Permits(permission, now));
    }
}
