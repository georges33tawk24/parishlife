// Purpose: handles following and primary-parish preferences, office-reviewed membership requests that end in a verified person link,
// and members' field-by-field corrections to their own official Person record.
// Main functions: FollowAsync, UnfollowAsync, SetPrimaryAsync, MyParishesAsync, RequestAsync, WithdrawRequestAsync, DecideAsync,
// OwnRequestsAsync, QueueAsync, ProposeCorrectionAsync, WithdrawCorrectionAsync, ReviewCorrectionAsync, CorrectionsAsync,
// MembershipNotificationOutcomeAsync and CorrectionNotificationOutcomeAsync expose source-authorized partial outcomes without recipient details.
// Required membership/correction notices are staged in their final source transactions and dispatched after commit.

using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.People;

public class MembershipService(IRecordTransactions records, IParishAccess access, IParishRepository parishes, MinistryAccess own,
    MinistryPersonLinkService links, PeopleService people, NotificationService notifications, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock,
    NotificationOutcomeReader notificationOutcomes)
{
    private static RecordScope Parish(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordScope Account(string account) => new() { Area = RecordArea.Account, OwnerId = account };
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested record is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_membership_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> OfficeAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.PeopleWrite, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    public async Task<IReadOnlyList<MyParishDto>> FollowAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        await own.RootAsync(parish, ct);
        await WriteFollowAsync(actor.AccountId, parish, ct);
        return await MyParishesAsync(ct);
    }

    // Unfollowing is a preference only; leaving an approved membership is a separate reviewed process.
    public async Task<IReadOnlyList<MyParishDto>> UnfollowAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        if (await records.ReadAsync<ParishFollow>(Account(actor.AccountId), "follow:" + parish, ct) is { } row)
            await records.CommitAsync(Account(actor.AccountId), Operation.Create(Guid.NewGuid(), actor.AccountId, new { parish }, clock), "parish.unfollow", parish,
                [RecordChange.Remove("follow:" + parish, row.Version)], new CommandResult { Id = parish, Status = "Unfollowed" }, ct);
        return await MyParishesAsync(ct);
    }

    public async Task<IReadOnlyList<MyParishDto>> SetPrimaryAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        if ((await MyParishesAsync(ct)).All(p => p.ParishId != parish))
            throw State("Follow or join the parish before choosing it as primary.");
        var existing = await records.ReadAsync<PrimaryParish>(Account(actor.AccountId), "primaryParish", ct);
        var value = new PrimaryParish { ParishId = parish, ChosenAt = clock.GetUtcNow() };
        await records.CommitAsync(Account(actor.AccountId), Operation.Create(Guid.NewGuid(), actor.AccountId, new { parish }, clock), "parish.primary", parish,
            [existing is null ? RecordChange.Create("primaryParish", "primaryParish", value) : RecordChange.Replace("primaryParish", "primaryParish", value, existing.Version)],
            new CommandResult { Id = parish, Status = "Primary" }, ct);
        return await MyParishesAsync(ct);
    }

    public async Task<IReadOnlyList<MyParishDto>> MyParishesAsync(CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var primary = (await records.ReadAsync<PrimaryParish>(Account(actor.AccountId), "primaryParish", ct))?.Value.ParishId;
        var result = new List<MyParishDto>();
        foreach (var follow in await records.CollectAsync<ParishFollow>(Account(actor.AccountId), "parishFollow", ct, 200))
        {
            var parish = (await parishes.GetAsync(follow.Value.ParishId, ct))?.Value;
            if (parish is null)
                continue;
            var link = (await records.ReadAsync<PersonAccountLink>(Parish(parish.Id), "personAccountLink:" + actor.AccountId, ct))?.Value;
            result.Add(new MyParishDto
            {
                ParishId = parish.Id, Name = parish.Name, Relationship = link?.Active == true ? "Member" : "Following", Primary = primary == parish.Id
            });
        }
        return result.OrderByDescending(p => p.Primary).ThenBy(p => p.Name, StringComparer.Ordinal).ToArray();
    }

    public async Task<MembershipRequestDto> RequestAsync(string parish, RequestMembershipDto request, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        await own.RootAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "membership-request:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Parish(parish), op, ct) is { } prior)
            return await ProjectOutcomeAsync(parish, (await ReadRequestAsync(parish, prior.Id, ct)).Value, false, ct);
        if ((await records.ReadAsync<PersonAccountLink>(Parish(parish), "personAccountLink:" + actor.AccountId, ct))?.Value.Active == true)
            throw State("Your account is already linked to a member record in this parish.");
        if ((await OwnRowsAsync(parish, ct)).Any(r => r.Status is "Submitted" or "NeedsInformation"))
            throw State("You already have a membership request waiting for this parish.");
        var item = new MembershipRequest
        {
            Id = op.Id, ParishId = parish, ApplicantAccountId = actor.AccountId, GivenName = Guard.Text(request.GivenName, "Given name", 100),
            FamilyName = Guard.Text(request.FamilyName, "Family name", 100), BirthDate = request.BirthDate,
            Contact = string.IsNullOrWhiteSpace(request.Contact) ? null : Guard.Text(request.Contact, "Contact", 300),
            Locality = string.IsNullOrWhiteSpace(request.Locality) ? null : Guard.Text(request.Locality, "Locality", 200),
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : Guard.Text(request.Note, "Note", 1000), SubmittedAt = op.At,
            NotificationWorkIds = []
        };
        await records.CommitAsync(Parish(parish), op, "membership.request", item.Id, [RecordChange.Create("membershipRequest:" + item.Id, "membershipRequest", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        await WriteFollowAsync(actor.AccountId, parish, ct);
        return await ProjectOutcomeAsync(parish, item, false, ct);
    }

    public async Task<MembershipRequestDto> WithdrawRequestAsync(string parish, string id, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var row = await ReadRequestAsync(parish, id, ct);
        if (row.Value.ApplicantAccountId != actor.AccountId)
            throw Missing();
        if (row.Value.Status is not ("Submitted" or "NeedsInformation"))
            throw State("Only a waiting request can be withdrawn.");
        row.Value.Status = "Withdrawn";
        await records.CommitAsync(Parish(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { id }, clock), "membership.withdraw", id,
            [RecordChange.Replace("membershipRequest:" + id, "membershipRequest", row.Value, row.Version)], new CommandResult { Id = id, Status = row.Value.Status }, ct);
        return await ProjectOutcomeAsync(parish, row.Value, false, ct);
    }

    public async Task<MembershipRequestDto> DecideAsync(string parish, string id, MembershipDecisionDto request, CancellationToken ct)
    {
        await OfficeAsync(parish, ct);
        var row = await ReadRequestAsync(parish, id, ct);
        var item = row.Value;
        if (item.Status is not ("Submitted" or "NeedsInformation"))
            throw State("This request has already been decided.");
        if (row.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The request changed; reload it before deciding.", FailureKind.Conflict);
        if (item.ApplicantAccountId == actor.AccountId)
            throw State("A different authorized reviewer decides your own membership.");
        string? person = null;
        // A retry after the link committed but the request did not finds the existing link and only finishes the request.
        var linked = (await records.ReadAsync<PersonAccountLink>(Parish(parish), "personAccountLink:" + item.ApplicantAccountId, ct))?.Value;
        switch (request.Action)
        {
            case "link":
                person = Guard.Id(request.PersonId ?? throw new DomainException("invalid_input", "Choose the person record that matches the applicant."));
                break;
            case "create-person" when linked is { Active: true }:
                person = linked.PersonId;
                break;
            case "create-person":
                // Likely duplicates (same names and birth date) are linked instead unless the reviewer confirms they are different people.
                var duplicates = (await records.CollectAsync<Person>(Parish(parish), "person", ct, 5000)).Select(r => r.Value)
                    .Where(p => !p.Archived && string.Equals(p.GivenName, item.GivenName, StringComparison.OrdinalIgnoreCase)
                        && string.Equals(p.FamilyName, item.FamilyName, StringComparison.OrdinalIgnoreCase) && p.BirthDate == item.BirthDate).ToList();
                if (duplicates.Count > 0 && !request.AllowPossibleDuplicate)
                    throw State("A person with the same names and birth date exists; link them instead, or confirm they are a different person.");
                person = (await people.CreateAsync(parish, new CreatePersonDto
                {
                    OperationId = request.OperationId, GivenName = item.GivenName, FamilyName = item.FamilyName, BirthDate = item.BirthDate, Contact = item.Contact
                }, ct)).Id;
                break;
            case "return":
            case "decline":
                item.ApplicantReason = Guard.Text(request.Reason, "Applicant-visible reason", 2000);
                item.Status = request.Action == "return" ? "NeedsInformation" : "Declined";
                break;
            default:
                throw new DomainException("invalid_input", "Use link, create-person, return or decline.");
        }
        if (person is not null)
        {
            // The link is its own atomic, reviewed write.
            if (linked is null)
                await links.LinkAsync(parish, new LinkMinistryPersonDto
                {
                    OperationId = Guid.NewGuid(), AccountId = Guid.Parse(item.ApplicantAccountId), PersonId = Guid.Parse(person),
                    EvidenceReference = Guard.Text(request.EvidenceReference, "Identity review evidence", 500)
                }, ct);
            else if (linked.PersonId != person || !linked.Active)
                throw State("This account is already linked to a different person; a reviewed identity correction is needed.");
            item.PersonId = person;
            item.Status = "Linked";
        }
        item.DecidedBy = actor.AccountId;
        item.DecidedAt = clock.GetUtcNow();
        var root = await parishes.GetAsync(parish, ct) ?? throw Missing();
        var notice = notifications.StageRequired(parish, item.ApplicantAccountId, "membership.decision", "Your parish membership request has an update.",
            "/api/parishes/" + parish + "/membership-requests/mine", "membership:" + id + ":" + row.Version, "MembershipApplicant", id, item.DecidedAt.Value);
        item.NotificationWorkIds = [((NotificationWork)notice.Value!).Id];
        await records.CommitAsync(Parish(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { id, request.Action }, clock, null, actor.ActingAppointmentId),
            "membership." + request.Action.Replace('-', '_'), id,
            [Fence(root), RecordChange.Replace("membershipRequest:" + id, "membershipRequest", item, row.Version), notice],
            new CommandResult { Id = id, Status = item.Status }, ct);
        await notifications.DispatchAsync(parish, item.ApplicantAccountId, "membership:" + id + ":" + row.Version, ct);
        return await ProjectOutcomeAsync(parish, item, true, ct);
    }

    public async Task<NotificationOutcomeDto> MembershipNotificationOutcomeAsync(string parish, string id, CancellationToken ct)
    {
        var item = (await ReadRequestAsync(parish, id, ct)).Value;
        await RequireOutcomeReaderAsync(parish, item.ApplicantAccountId, ct);
        return await notificationOutcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
    }

    public async Task<NotificationOutcomeDto> CorrectionNotificationOutcomeAsync(string parish, string id, CancellationToken ct)
    {
        var item = (await ReadCorrectionAsync(parish, id, ct)).Value;
        await RequireOutcomeReaderAsync(parish, item.ApplicantAccountId, ct);
        return await notificationOutcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
    }

    private async Task RequireOutcomeReaderAsync(string parish, string applicant, CancellationToken ct)
    {
        if (actor.AccountId == applicant && actor.ActingAppointmentId is null)
        {
            await own.PersonalAsync(ct);
            return;
        }
        try { await OfficeAsync(parish, ct); }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { throw Missing(); }
    }

    public async Task<IReadOnlyList<MembershipRequestDto>> OwnRequestsAsync(string parish, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        return (await OwnRowsAsync(parish, ct)).Select(r => Project(r, false)).ToArray();
    }

    public async Task<IReadOnlyList<Versioned<MembershipRequestDto>>> QueueAsync(string parish, CancellationToken ct)
    {
        await OfficeAsync(parish, ct);
        return (await records.CollectAsync<MembershipRequest>(Parish(parish), "membershipRequest", ct, 2000))
            .OrderBy(r => r.Value.SubmittedAt).Select(r => new Versioned<MembershipRequestDto> { Version = r.Version, Value = Project(r.Value, true) }).ToArray();
    }

    public async Task<ProfileCorrectionDto> ProposeCorrectionAsync(string parish, ProposeProfileCorrectionDto request, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "profile-correction:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Parish(parish), op, ct) is { } prior)
            return await ProjectOutcomeAsync(parish, (await ReadCorrectionAsync(parish, prior.Id, ct)).Value, ct);
        if ((await records.CollectAsync<ProfileCorrection>(Parish(parish), "profileCorrection", ct, 200, Equal("personId", link.Value.PersonId))).Any(r => r.Value.Status == "Pending"))
            throw State("You already have a correction waiting for review; withdraw it to propose a different one.");
        if (request.Fields is null || request.Fields.Length is < 1 or > 4 || request.Fields.Select(f => f.Field).Distinct().Count() != request.Fields.Length)
            throw new DomainException("invalid_input", "Propose one change per field, up to four fields.");
        var person = (await records.ReadAsync<Person>(Parish(parish), "person:" + link.Value.PersonId, ct) ?? throw Missing()).Value;
        var fields = request.Fields.Select(f =>
        {
            var value = Guard.Text(f.NewValue, f.Field, 300);
            if (f.Field == "BirthDate" && !DateOnly.TryParseExact(value, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out _))
                throw new DomainException("invalid_input", "Give the birth date as yyyy-MM-dd.");
            // Names and birth facts need supporting evidence; sacramental and register facts are never changed this way.
            var evidence = string.IsNullOrWhiteSpace(f.Evidence) ? null : Guard.Text(f.Evidence, "Evidence", 1000);
            if (f.Field is "GivenName" or "FamilyName" or "BirthDate" && evidence is null)
                throw new DomainException("invalid_input", "Name and birth-date corrections need supporting evidence.");
            return new ProfileCorrectionField { Field = f.Field, OldValue = Value(person, f.Field), NewValue = value, Evidence = evidence };
        }).ToArray();
        var item = new ProfileCorrection { Id = op.Id, ParishId = parish, ApplicantAccountId = actor.AccountId, PersonId = person.Id, Fields = fields, SubmittedAt = op.At, NotificationWorkIds = [] };
        await records.CommitAsync(Parish(parish), op, "person.correction_propose", item.Id, [RecordChange.Create("profileCorrection:" + item.Id, "profileCorrection", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await ProjectOutcomeAsync(parish, item, ct);
    }

    public async Task<ProfileCorrectionDto> WithdrawCorrectionAsync(string parish, string id, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var row = await ReadCorrectionAsync(parish, id, ct);
        if (row.Value.ApplicantAccountId != actor.AccountId)
            throw Missing();
        if (row.Value.Status != "Pending")
            throw State("Only a pending correction can be withdrawn.");
        row.Value.Status = "Withdrawn";
        await records.CommitAsync(Parish(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { id }, clock), "person.correction_withdraw", id,
            [RecordChange.Replace("profileCorrection:" + id, "profileCorrection", row.Value, row.Version)], new CommandResult { Id = id, Status = row.Value.Status }, ct);
        return await ProjectOutcomeAsync(parish, row.Value, ct);
    }

    public async Task<ProfileCorrectionDto> ReviewCorrectionAsync(string parish, string id, ReviewProfileCorrectionDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "profile-correction-review:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Parish(parish), op, ct) is not null)
            return await ProjectOutcomeAsync(parish, (await ReadCorrectionAsync(parish, id, ct)).Value, ct);
        var item = (await ReadCorrectionAsync(parish, id, ct)).Value;
        if (item.Status != "Pending" || item.ApplicantAccountId == actor.AccountId)
            throw State("A different reviewer decides a pending correction.");
        if (request.Decisions is null || item.Fields.Any(f => request.Decisions.Count(d => d.Field == f.Field) != 1) || request.Decisions.Length != item.Fields.Length)
            throw new DomainException("invalid_input", "Decide every proposed field exactly once.");
        var personRow = await records.ReadAsync<Person>(Parish(parish), "person:" + item.PersonId, ct) ?? throw Missing();
        foreach (var field in item.Fields)
        {
            var decision = request.Decisions.Single(d => d.Field == field.Field);
            field.Decision = decision.Approve ? "Approved" : "Declined";
            field.Reason = decision.Approve ? null : Guard.Text(decision.Reason, "Reason for declining " + field.Field, 1000);
            // A staff edit since the proposal is never silently overwritten: the reviewer declines and the member proposes again.
            if (decision.Approve && Value(personRow.Value, field.Field) != field.OldValue)
                throw State("The official " + field.Field + " changed after this correction was proposed; decline it with a reason so a fresh proposal can be made.");
            if (decision.Approve)
                Apply(personRow.Value, field);
        }
        item.Status = "Reviewed";
        item.ReviewedBy = actor.AccountId;
        item.ReviewedAt = op.At;
        var notice = notifications.StageRequired(parish, item.ApplicantAccountId, "profile.correction", "Your profile correction has been reviewed.",
            "/api/parishes/" + parish + "/profile-corrections/mine", "correction:" + id, "CorrectionApplicant", id, op.At);
        item.NotificationWorkIds = [((NotificationWork)notice.Value!).Id];
        // Approved fields change the Person in the same transaction; the correction keeps every old value.
        await records.CommitAsync(Parish(parish), op, "person.correction_review", id,
            [Fence(root), RecordChange.Replace("profileCorrection:" + id, "profileCorrection", item, Versions.Require(request.Version)),
             RecordChange.Replace("person:" + item.PersonId, "person", personRow.Value, personRow.Version), notice],
            new CommandResult { Id = id, Status = item.Status }, ct);
        await notifications.DispatchAsync(parish, item.ApplicantAccountId, "correction:" + id, ct);
        return await ProjectOutcomeAsync(parish, item, ct);
    }

    public async Task<IReadOnlyList<Versioned<ProfileCorrectionDto>>> CorrectionsAsync(string parish, bool mine, CancellationToken ct)
    {
        IEnumerable<Versioned<ProfileCorrection>> rows;
        if (mine)
        {
            var link = await own.OwnLinkAsync(parish, ct);
            rows = await records.CollectAsync<ProfileCorrection>(Parish(parish), "profileCorrection", ct, 200, Equal("personId", link.Value.PersonId));
        }
        else
        {
            await OfficeAsync(parish, ct);
            rows = await records.CollectAsync<ProfileCorrection>(Parish(parish), "profileCorrection", ct, 2000, Equal("status", "Pending"));
        }
        return rows.Select(r => new Versioned<ProfileCorrectionDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    private async Task WriteFollowAsync(string account, string parish, CancellationToken ct)
    {
        if (await records.ReadAsync<ParishFollow>(Account(account), "follow:" + parish, ct) is not null)
            return;
        try
        {
            await records.CommitAsync(Account(account), Operation.Create(Guid.NewGuid(), account, new { parish }, clock), "parish.follow", parish,
                [RecordChange.Create("follow:" + parish, "parishFollow", new ParishFollow { ParishId = parish, FollowedAt = clock.GetUtcNow() })],
                new CommandResult { Id = parish, Status = "Following" }, ct);
        }
        catch (DomainException error) when (error.Code == "write_conflict") { }
    }

    private async Task<List<MembershipRequest>> OwnRowsAsync(string parish, CancellationToken ct)
        => (await records.CollectAsync<MembershipRequest>(Parish(parish), "membershipRequest", ct, 200, Equal("applicantAccountId", actor.AccountId))).Select(r => r.Value).ToList();

    private static string? Value(Person person, string field) => field switch
    {
        "GivenName" => person.GivenName,
        "FamilyName" => person.FamilyName,
        "BirthDate" => person.BirthDate?.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
        "Contact" => person.Contact,
        _ => throw new DomainException("invalid_input", "Unsupported field.")
    };

    private static void Apply(Person person, ProfileCorrectionField field)
    {
        switch (field.Field)
        {
            case "GivenName": person.GivenName = field.NewValue; break;
            case "FamilyName": person.FamilyName = field.NewValue; break;
            case "BirthDate": person.BirthDate = DateOnly.ParseExact(field.NewValue, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture); break;
            case "Contact": person.Contact = field.NewValue; break;
        }
    }

    private async Task<Versioned<MembershipRequest>> ReadRequestAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<MembershipRequest>(Parish(parish), "membershipRequest:" + id, ct) is { } row && row.Value.ParishId == parish && row.Value.Id == id ? row : throw Missing();

    private async Task<Versioned<ProfileCorrection>> ReadCorrectionAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<ProfileCorrection>(Parish(parish), "profileCorrection:" + id, ct) is { } row && row.Value.ParishId == parish && row.Value.Id == id ? row : throw Missing();

    private async Task<MembershipRequestDto> ProjectOutcomeAsync(string parish, MembershipRequest item, bool office, CancellationToken ct)
    {
        var result = Project(item, office);
        result.NotificationOutcome = await notificationOutcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
        return result;
    }

    private async Task<ProfileCorrectionDto> ProjectOutcomeAsync(string parish, ProfileCorrection item, CancellationToken ct)
    {
        var result = Project(item);
        result.NotificationOutcome = await notificationOutcomes.ReadAsync(parish, item.NotificationWorkIds, ct);
        return result;
    }

    private static MembershipRequestDto Project(MembershipRequest x, bool office) => new()
    {
        Id = x.Id, ApplicantAccountId = office ? x.ApplicantAccountId : null, GivenName = x.GivenName, FamilyName = x.FamilyName, BirthDate = x.BirthDate,
        Contact = x.Contact, Locality = x.Locality, Note = x.Note, Status = x.Status, PersonId = office ? x.PersonId : null, ApplicantReason = x.ApplicantReason,
        SubmittedAt = x.SubmittedAt, DecidedAt = x.DecidedAt
    };

    private static ProfileCorrectionDto Project(ProfileCorrection x) => new()
    {
        Id = x.Id, PersonId = x.PersonId, Status = x.Status, SubmittedAt = x.SubmittedAt, ReviewedAt = x.ReviewedAt,
        Fields = x.Fields.Select(f => new ProfileCorrectionFieldDto { Field = f.Field, NewValue = f.NewValue, Evidence = f.Evidence, OldValue = f.OldValue, Decision = f.Decision, Reason = f.Reason }).ToArray()
    };
}
