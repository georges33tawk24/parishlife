// Purpose: Contains ministry, leadership, application, roster, and private-departure rules with explicit clergy
// authorization.
// Main functions: Scope, MemberKey, Op, Missing, State, Office, RequireLeader, OwnLink, Member, SaveAsync,
// ListAsync, GetAsync, ActAsync, AppointAsync, LinkPersonAsync, ApplyAsync, ApplicationAsync, ApplicationsAsync,
// ActApplicationAsync, SavePrivateReasonAsync, PrivateReasonAsync, RosterAsync.

using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public sealed class MinistryService(IRecordTransactions records, IParishAccess access, IParishRepository parishes, ICurrentActor actor, IAccountDirectory accounts, IClergyAuthority clergy, TimeProvider clock)
{
    internal static RecordScope Scope(string parish) => new RecordScope
    {
        Area = RecordArea.Parish,
        OwnerId = parish
    };
    internal static string MemberKey(string ministry, string person) => "ministryMembership:" + ministry + ":" + person;
    private Operation Op(Guid id, object request, string target) => actor.CreateOperation(id, request, clock, target);
    internal static DomainException Missing() => new("resource_not_found", "The requested ministry resource is unavailable.", FailureKind.NotFound);
    internal static DomainException State(string message) => new("invalid_ministry_state", message, FailureKind.Conflict);
    internal async Task Office(string parish, CancellationToken ct)
    {
        await access.RequireAsync(parish, Permissions.MinistriesManage, ct);
        await access.RequireModuleAsync(parish, "ministries", ct);
    }

    internal async Task<Versioned<Ministry>> RequireLeader(string parish, string ministry, CancellationToken ct)
    {
        await access.RequireModuleAsync(parish, "ministries", ct);
        if (actor.ActingAppointmentId is not null)
        {
            await access.RequireAsync(parish, Permissions.MinistriesManage, ct);
            return await records.ReadAsync<Ministry>(Scope(parish), "ministry:" + ministry, ct) ?? throw Missing();
        }
        var mine = await parishes.GetGrantAsync(parish, actor.AccountId, ct);
        if (mine?.Denies.Contains(Permissions.MinistriesManage, StringComparer.Ordinal) == true)
            throw Missing();
        if (mine?.Permits(Permissions.MinistriesManage, clock.GetUtcNow()) != true)
        {
            var appointment = await records.ReadAsync<MinistryLeader>(Scope(parish), "ministryLeader:" + ministry + ":" + actor.AccountId, ct);
            if (appointment?.Value.Current(clock.GetUtcNow()) != true)
                throw Missing();
        }

        return await records.ReadAsync<Ministry>(Scope(parish), "ministry:" + ministry, ct) ?? throw Missing();
    }

    internal async Task<PersonAccountLink> OwnLink(string parish, CancellationToken ct)
    {
        var link = await records.ReadAsync<PersonAccountLink>(Scope(parish), "personAccountLink:" + actor.AccountId, ct);
        if (link?.Value.Active != true)
            throw Missing();
        var person = await records.ReadAsync<Person>(Scope(parish), "person:" + link.Value.PersonId, ct);
        if (person is null || person.Value.Archived)
            throw Missing();
        return link.Value;
    }

    internal async Task<MinistryMembership> Member(string parish, string ministry, string person, CancellationToken ct)
    {
        var membership = await records.ReadAsync<MinistryMembership>(Scope(parish), MemberKey(ministry, person), ct);
        if (membership?.Value.Current(clock.GetUtcNow()) != true)
            throw Missing();
        return membership.Value;
    }

    public async Task<Ministry> SaveAsync(string parish, string? id, SaveMinistryDto request, CancellationToken ct)
    {
        await Office(parish, ct);
        var scope = Scope(parish);
        var op = Op(request.OperationId, request, "ministry:" + id);
        if (await records.ReplayAsync<Ministry>(scope, op, ct) is { } replay)
            return replay;
        var old = id is null ? null : await records.ReadAsync<Ministry>(scope, "ministry:" + id, ct) ?? throw Missing();
        if (old?.Value.Status is "Archived")
            throw State("Restore the ministry before changing it.");
        var item = new Ministry
        {
            Id = id ?? op.Id,
            ParishId = parish,
            Name = Guard.Text(request.Name, "Name"),
            Kind = Guard.Text(request.Kind, "Type", 80),
            Purpose = Guard.Text(request.Purpose, "Purpose", 4000),
            Status = "Draft",
            PublicListed = false,
            CreatedBy = old?.Value.CreatedBy ?? actor.AccountId,
            CreatedAt = old?.Value.CreatedAt ?? op.At,
            EligibilityPolicyReference = request.EligibilityPolicyReference is null ? null : Guard.Text(request.EligibilityPolicyReference, "Eligibility policy", 1000)
        };
        return await records.CommitAsync(scope, op, "ministry.save_draft", item.Id, [old is null ? RecordChange.Create("ministry:" + item.Id, "ministry", item) : RecordChange.Replace("ministry:" + item.Id, "ministry", item, Versions.Require(request.Version))], item, ct);
    }

    public async Task<Page<Versioned<Ministry>>> ListAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await Office(parish, ct);
        return await records.PageAsync<Ministry>(Scope(parish), "ministry", size, cursor, ct);
    }

    public Task<Versioned<Ministry>> GetAsync(string parish, string ministry, CancellationToken ct) => RequireLeader(parish, ministry, ct);
    public async Task<Ministry> ActAsync(string parish, string ministry, MinistryActionDto request, CancellationToken ct)
    {
        await Office(parish, ct);
        var op = Op(request.OperationId, request, "ministry:" + ministry);
        if (await records.ReplayAsync<Ministry>(Scope(parish), op, ct) is { } replay)
            return replay;
        var row = await records.ReadAsync<Ministry>(Scope(parish), "ministry:" + ministry, ct) ?? throw Missing();
        Guard.Text(request.Reason, "Reason", 1000);
        var item = row.Value;
        if (request.Action is "approve" or "publish")
        {
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
            if (request.Action == "approve" && item.Status != "Draft" || request.Action == "publish" && item.Status != "Active")
                throw State("Approve the current ministry draft before publishing.");
            item = new Ministry
            {
                Id = item.Id,
                ParishId = item.ParishId,
                Name = item.Name,
                Kind = item.Kind,
                Purpose = item.Purpose,
                Status = "Active",
                PublicListed = request.Action == "publish",
                CreatedBy = item.CreatedBy,
                CreatedAt = item.CreatedAt,
                EligibilityPolicyReference = item.EligibilityPolicyReference
            };
        }
        else if (request.Action == "unpublish")
            item = new Ministry
            {
                Id = item.Id,
                ParishId = item.ParishId,
                Name = item.Name,
                Kind = item.Kind,
                Purpose = item.Purpose,
                Status = item.Status,
                PublicListed = false,
                CreatedBy = item.CreatedBy,
                CreatedAt = item.CreatedAt,
                EligibilityPolicyReference = item.EligibilityPolicyReference
            };
        else if (request.Action == "archive")
            item = new Ministry
            {
                Id = item.Id,
                ParishId = item.ParishId,
                Name = item.Name,
                Kind = item.Kind,
                Purpose = item.Purpose,
                Status = "Archived",
                PublicListed = false,
                CreatedBy = item.CreatedBy,
                CreatedAt = item.CreatedAt,
                EligibilityPolicyReference = item.EligibilityPolicyReference
            };
        else if (request.Action == "restore" && item.Status == "Archived")
            item = new Ministry
            {
                Id = item.Id,
                ParishId = item.ParishId,
                Name = item.Name,
                Kind = item.Kind,
                Purpose = item.Purpose,
                Status = "Draft",
                PublicListed = false,
                CreatedBy = item.CreatedBy,
                CreatedAt = item.CreatedAt,
                EligibilityPolicyReference = item.EligibilityPolicyReference
            };
        else
            throw State("This ministry action is unavailable.");
        return await records.CommitAsync(Scope(parish), op, "ministry." + request.Action, ministry, [RecordChange.Replace("ministry:" + ministry, "ministry", item, Versions.Require(request.Version))], item, ct, request.Reason);
    }

    public async Task<MinistryLeader> AppointAsync(string parish, string ministry, AppointLeaderDto request, CancellationToken ct)
    {
        await Office(parish, ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        var scope = Scope(parish);
        var op = Op(request.OperationId, request, "ministry-leader:" + ministry);
        if (await records.ReplayAsync<MinistryLeader>(scope, op, ct) is { } replay)
            return replay;
        var group = await records.ReadAsync<Ministry>(scope, "ministry:" + ministry, ct) ?? throw Missing();
        if (group.Value.Status != "Active" || request.Role is not ("Leader" or "Assistant"))
            throw State("An active ministry and supported leadership role are required.");
        var account = Guard.Id(request.AccountId);
        Guard.Utc(request.StartsAt);
        if (request.EndsAt is { } end && Guard.Utc(end) <= request.StartsAt)
            throw State("The appointment end must follow its start.");
        if (!await accounts.IsActiveVerifiedAsync(account, ct))
            throw Missing();
        var key = "ministryLeader:" + ministry + ":" + account;
        var previous = await records.ReadAsync<MinistryLeader>(scope, key, ct);
        var appointment = new MinistryLeader
        {
            Id = account,
            MinistryId = ministry,
            AccountId = account,
            Role = request.Role,
            StartsAt = request.StartsAt,
            EndsAt = request.EndsAt,
            Revoked = false,
            AppointedBy = actor.AccountId,
            EvidenceReference = Guard.Text(request.EvidenceReference, "Appointment authority", 1000)
        };
        var changes = new List<RecordChange>
        {
            RecordChange.Replace("ministry:" + ministry, "ministry", group.Value, Versions.Require(request.MinistryVersion)),
            previous is null ? RecordChange.Create(key, "ministryLeader", appointment) : RecordChange.Replace(key, "ministryLeader", appointment, previous.Version),
            RecordChange.Create("ministryLeadershipHistory:" + op.Id, "ministryLeadershipHistory", appointment)
        };
        if (request.ReplaceAccountId is { } outgoingId)
        {
            var outgoing = Guard.Id(outgoingId);
            if (outgoing == account || request.StartsAt > clock.GetUtcNow())
                throw State("A handover requires a different leader and an effective time no later than now.");
            var oldKey = "ministryLeader:" + ministry + ":" + outgoing;
            var old = await records.ReadAsync<MinistryLeader>(scope, oldKey, ct) ?? throw Missing();
            changes.Add(RecordChange.Replace(oldKey, "ministryLeader", new MinistryLeader { Id = old.Value.Id, MinistryId = old.Value.MinistryId, AccountId = old.Value.AccountId, Role = old.Value.Role, StartsAt = old.Value.StartsAt, EndsAt = clock.GetUtcNow(), Revoked = true, AppointedBy = old.Value.AppointedBy, EvidenceReference = old.Value.EvidenceReference }, old.Version));
        }

        return await records.CommitAsync(scope, op, "ministry.appoint_leader", ministry, changes, appointment, ct);
    }

    public async Task<PersonAccountLink> LinkPersonAsync(string parish, LinkMinistryPersonDto request, CancellationToken ct)
    {
        await access.RequireAsync(parish, Permissions.PeopleWrite, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        var scope = Scope(parish);
        var op = Op(request.OperationId, request, "person-account-link");
        if (await records.ReplayAsync<PersonAccountLink>(scope, op, ct) is { } replay)
            return replay;
        var account = Guard.Id(request.AccountId);
        var person = Guard.Id(request.PersonId);
        if (!await accounts.IsActiveVerifiedAsync(account, ct) || (await records.ReadAsync<Person>(scope, "person:" + person, ct))?.Value.Archived != false)
            throw Missing();
        var key = "personAccountLink:" + account;
        var old = await records.ReadAsync<PersonAccountLink>(scope, key, ct);
        // Relinking an existing identity requires a separate reviewed identity correction.
        if (old is not null && old.Value.PersonId != person)
            throw State("An existing account link requires an identity correction review.");
        var link = new PersonAccountLink
        {
            Id = account,
            ParishId = parish,
            PersonId = person,
            AccountId = account,
            VerifiedBy = actor.AccountId,
            VerifiedAt = op.At,
            EvidenceReference = Guard.Text(request.EvidenceReference, "Identity matching evidence", 1000)
        };
        var personKey = "personAccountClaim:" + person;
        var claim = await records.ReadAsync<CommandResult>(scope, personKey, ct);
        if (claim is not null && claim.Value.Id != account)
            throw State("The person is already linked to another account.");
        var changes = new List<RecordChange>
        {
            old is null ? RecordChange.Create(key, "personAccountLink", link) : RecordChange.Replace(key, "personAccountLink", link, Versions.Require(request.Version))
        };
        if (claim is null)
            changes.Add(RecordChange.Create(personKey, "personAccountClaim", new CommandResult { Id = account, Status = "Linked" }));
        return await records.CommitAsync(scope, op, "person.link_account", person, changes, link, ct);
    }

    public async Task<MinistryApplication> ApplyAsync(string parish, string ministry, ApplyMinistryDto request, CancellationToken ct)
    {
        await access.RequireModuleAsync(parish, "ministries", ct);
        var scope = Scope(parish);
        var op = Op(request.OperationId, request, "ministry-application:" + ministry);
        if (await records.ReplayAsync<MinistryApplication>(scope, op, ct) is { } replay)
            return replay;
        var group = await records.ReadAsync<Ministry>(scope, "ministry:" + ministry, ct) ?? throw Missing();
        if (group.Value.Status != "Active" || request.Kind is not ("Join" or "Leave"))
            throw State("Choose join or leave for an active ministry.");
        string person;
        string? applicant = actor.AccountId;
        if (request.PersonId is { } target)
        {
            await Office(parish, ct);
            person = Guard.Id(target);
            applicant = null;
            Guard.Text(request.RepresentationEvidence, "Applicant instruction or representation evidence", 1000);
            if ((await records.ReadAsync<Person>(scope, "person:" + person, ct))?.Value.Archived != false)
                throw Missing();
        }
        else
            person = (await OwnLink(parish, ct)).PersonId;
        var membership = await records.ReadAsync<MinistryMembership>(scope, MemberKey(ministry, person), ct);
        if (request.Kind == "Join" && membership?.Value.Current(op.At) == true || request.Kind == "Leave" && membership?.Value.Current(op.At) != true)
            throw State("The request does not match the person's current membership.");
        var guardKey = "ministryApplicationGuard:" + ministry + ":" + person;
        var guard = await records.ReadAsync<CommandResult>(scope, guardKey, ct);
        if (guard?.Value.Status == "Pending")
            throw State("Resolve the existing membership application first.");
        var application = new MinistryApplication
        {
            Id = op.Id,
            MinistryId = ministry,
            PersonId = person,
            ApplicantAccountId = applicant,
            Kind = request.Kind,
            Status = request.Kind == "Leave" ? "AwaitingPriest" : "Submitted",
            SubmittedBy = actor.AccountId,
            SubmittedAt = op.At
        };
        return await records.CommitAsync(scope, op, "ministry.application_submit", op.Id, [RecordChange.Create("ministryApplication:" + op.Id, "ministryApplication", application), guard is null ? RecordChange.Create(guardKey, "ministryApplicationGuard", new CommandResult { Id = op.Id, Status = "Pending" }) : RecordChange.Replace(guardKey, "ministryApplicationGuard", new CommandResult { Id = op.Id, Status = "Pending" }, guard.Version), RecordChange.Replace("ministry:" + ministry, "ministry", group.Value, group.Version)], application, ct);
    }

    public async Task<Versioned<MinistryApplication>> ApplicationAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        await access.RequireModuleAsync(parish, "ministries", ct);
        var row = await records.ReadAsync<MinistryApplication>(Scope(parish), "ministryApplication:" + id, ct) ?? throw Missing();
        if (row.Value.MinistryId != ministry)
            throw Missing();
        if (row.Value.ApplicantAccountId != actor.AccountId)
        {
            if (row.Value.Kind == "Leave")
                await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
            else
                await RequireLeader(parish, ministry, ct);
        }

        return row;
    }

    public async Task<Page<Versioned<MinistryApplication>>> ApplicationsAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        await RequireLeader(parish, ministry, ct);
        return await records.PageAsync<MinistryApplication>(Scope(parish), "ministryApplication", size, cursor, ct, new RecordCondition { Path = "ministryId", Comparison = "eq", Value = ministry }, new RecordCondition { Path = "kind", Comparison = "eq", Value = "Join" });
    }

    public async Task<MinistryApplication> ActApplicationAsync(string parish, string ministry, string id, ApplicationActionDto request, CancellationToken ct)
    {
        var row = await ApplicationAsync(parish, ministry, id, ct);
        var scope = Scope(parish);
        var op = Op(request.OperationId, request, "ministry-application:" + id);
        if (await records.ReplayAsync<MinistryApplication>(scope, op, ct) is { } replay)
            return replay;
        var item = row.Value;
        if (item.Status is "Approved" or "Declined" or "Withdrawn")
            throw State("The application has already ended.");
        var group = await records.ReadAsync<Ministry>(scope, "ministry:" + ministry, ct) ?? throw Missing();
        var changes = new List<RecordChange>
        {
            RecordChange.Replace("ministry:" + ministry, "ministry", group.Value, group.Version)
        };
        if (request.Action == "withdraw")
        {
            if (item.ApplicantAccountId != actor.AccountId)
                throw Missing();
            item = item.Status == "Submitted" ? new MinistryApplication
            {
                Id = item.Id,
                MinistryId = item.MinistryId,
                PersonId = item.PersonId,
                ApplicantAccountId = item.ApplicantAccountId,
                Kind = item.Kind,
                Status = "Withdrawn",
                SubmittedBy = item.SubmittedBy,
                SubmittedAt = item.SubmittedAt,
                ReviewedBy = item.ReviewedBy,
                DecidedBy = item.DecidedBy,
                DecidedAt = item.DecidedAt,
                PriorStatus = item.PriorStatus
            }

            : new MinistryApplication
            {
                Id = item.Id,
                MinistryId = item.MinistryId,
                PersonId = item.PersonId,
                ApplicantAccountId = item.ApplicantAccountId,
                Kind = item.Kind,
                Status = "WithdrawalRequested",
                SubmittedBy = item.SubmittedBy,
                SubmittedAt = item.SubmittedAt,
                ReviewedBy = item.ReviewedBy,
                DecidedBy = item.DecidedBy,
                DecidedAt = item.DecidedAt,
                PriorStatus = item.Status
            };
        }
        else if (request.Action is "recommend" or "return")
        {
            await RequireLeader(parish, ministry, ct);
            if (item.Kind != "Join" || item.Status != "Submitted" || item.SubmittedBy == actor.AccountId || item.ApplicantAccountId == actor.AccountId)
                throw State("An independent leader may review a submitted join application.");
            item = new MinistryApplication
            {
                Id = item.Id,
                MinistryId = item.MinistryId,
                PersonId = item.PersonId,
                ApplicantAccountId = item.ApplicantAccountId,
                Kind = item.Kind,
                Status = request.Action == "recommend" ? "AwaitingPriest" : "Returned",
                SubmittedBy = item.SubmittedBy,
                SubmittedAt = item.SubmittedAt,
                ReviewedBy = actor.AccountId,
                DecidedBy = item.DecidedBy,
                DecidedAt = item.DecidedAt,
                PriorStatus = item.PriorStatus
            };
        }
        else if (request.Action == "resubmit")
        {
            if (item.ApplicantAccountId != actor.AccountId || item.Status != "Returned")
                throw State("Only the applicant can resubmit a returned application.");
            item = new MinistryApplication
            {
                Id = item.Id,
                MinistryId = item.MinistryId,
                PersonId = item.PersonId,
                ApplicantAccountId = item.ApplicantAccountId,
                Kind = item.Kind,
                Status = "Submitted",
                SubmittedBy = item.SubmittedBy,
                SubmittedAt = item.SubmittedAt,
                ReviewedBy = null,
                DecidedBy = item.DecidedBy,
                DecidedAt = item.DecidedAt,
                PriorStatus = item.PriorStatus
            };
        }
        else if (request.Action is "approve" or "decline" or "approve-withdrawal" or "deny-withdrawal")
        {
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
            if (item.ApplicantAccountId == actor.AccountId || item.SubmittedBy == actor.AccountId)
                throw State("A different qualified priest must decide this application.");
            if (request.Action.Contains("withdrawal", StringComparison.Ordinal))
            {
                if (item.Status != "WithdrawalRequested")
                    throw State("There is no pending withdrawal request.");
                item = new MinistryApplication
                {
                    Id = item.Id,
                    MinistryId = item.MinistryId,
                    PersonId = item.PersonId,
                    ApplicantAccountId = item.ApplicantAccountId,
                    Kind = item.Kind,
                    Status = request.Action == "approve-withdrawal" ? "Withdrawn" : item.PriorStatus ?? "AwaitingPriest",
                    SubmittedBy = item.SubmittedBy,
                    SubmittedAt = item.SubmittedAt,
                    ReviewedBy = item.ReviewedBy,
                    DecidedBy = item.DecidedBy,
                    DecidedAt = item.DecidedAt,
                    PriorStatus = null
                };
            }
            else
            {
                if (item.Status != "AwaitingPriest" || group.Value.Status != "Active")
                    throw State("The application must await a priest decision in an active ministry.");
                item = new MinistryApplication
                {
                    Id = item.Id,
                    MinistryId = item.MinistryId,
                    PersonId = item.PersonId,
                    ApplicantAccountId = item.ApplicantAccountId,
                    Kind = item.Kind,
                    Status = request.Action == "approve" ? "Approved" : "Declined",
                    SubmittedBy = item.SubmittedBy,
                    SubmittedAt = item.SubmittedAt,
                    ReviewedBy = item.ReviewedBy,
                    DecidedBy = actor.AccountId,
                    DecidedAt = op.At,
                    PriorStatus = item.PriorStatus
                };
                if (request.Action == "approve")
                {
                    var memberKey = MemberKey(ministry, item.PersonId);
                    var member = await records.ReadAsync<MinistryMembership>(scope, memberKey, ct);
                    MinistryMembership membership;
                    if (item.Kind == "Join")
                    {
                        if (member?.Value.Current(op.At) == true)
                            throw State("The person is already an active member.");
                        membership = new MinistryMembership
                        {
                            Id = item.PersonId,
                            MinistryId = ministry,
                            PersonId = item.PersonId,
                            JoinedAt = op.At,
                            LeftAt = null,
                            ApprovedBy = actor.AccountId,
                            ApplicationId = id
                        };
                    }
                    else
                    {
                        if (member?.Value.Current(op.At) != true)
                            throw State("There is no active membership to end.");
                        membership = new MinistryMembership
                        {
                            Id = member.Value.Id,
                            MinistryId = member.Value.MinistryId,
                            PersonId = member.Value.PersonId,
                            JoinedAt = member.Value.JoinedAt,
                            LeftAt = op.At,
                            ApprovedBy = actor.AccountId,
                            ApplicationId = id
                        };
                        // Departure immediately ends a linked leadership appointment.
                        if (item.ApplicantAccountId is { } account)
                        {
                            var leaderKey = "ministryLeader:" + ministry + ":" + account;
                            var leader = await records.ReadAsync<MinistryLeader>(scope, leaderKey, ct);
                            if (leader is not null)
                                changes.Add(RecordChange.Replace(leaderKey, "ministryLeader", new MinistryLeader { Id = leader.Value.Id, MinistryId = leader.Value.MinistryId, AccountId = leader.Value.AccountId, Role = leader.Value.Role, StartsAt = leader.Value.StartsAt, EndsAt = op.At, Revoked = true, AppointedBy = leader.Value.AppointedBy, EvidenceReference = leader.Value.EvidenceReference }, leader.Version));
                        }
                    }

                    changes.Add(member is null ? RecordChange.Create(memberKey, "ministryMembership", membership) : RecordChange.Replace(memberKey, "ministryMembership", membership, member.Version));
                    changes.Add(RecordChange.Create("ministryMembershipHistory:" + op.Id, "ministryMembershipHistory", membership));
                }
            }
        }
        else
            throw State("Unsupported application action.");
        if (item.Status is "Approved" or "Declined" or "Withdrawn")
        {
            var guardKey = "ministryApplicationGuard:" + ministry + ":" + item.PersonId;
            var guard = await records.ReadAsync<CommandResult>(scope, guardKey, ct) ?? throw Missing();
            changes.Add(RecordChange.Replace(guardKey, "ministryApplicationGuard", new CommandResult { Id = id, Status = "Ended" }, guard.Version));
        }

        changes.Add(RecordChange.Replace("ministryApplication:" + id, "ministryApplication", item, Versions.Require(request.Version)));
        // Decision reasons may contain pastoral information; the general audit records only the action.
        return await records.CommitAsync(scope, op, "ministry.application_" + request.Action, id, changes, item, ct);
    }

    public async Task<MinistryPrivateReason> SavePrivateReasonAsync(string parish, string ministry, string id, PrivateDepartureReasonDto request, CancellationToken ct)
    {
        var application = await ApplicationAsync(parish, ministry, id, ct);
        if (application.Value.Kind != "Leave" || application.Value.ApplicantAccountId != actor.AccountId)
            throw Missing();
        var scope = new RecordScope
        {
            Area = RecordArea.PrivateCase,
            OwnerId = "ministry-leave:" + id
        };
        var op = Op(request.OperationId, request, "private-leave:" + id);
        var old = await records.ReadAsync<MinistryPrivateReason>(scope, "reason", ct);
        var item = new MinistryPrivateReason
        {
            Id = id,
            ParishId = parish,
            MinistryId = ministry,
            ApplicationId = id,
            ApplicantAccountId = actor.AccountId,
            Reason = Guard.Text(request.Reason, "Private reason", 10000),
            RecordedAt = op.At
        };
        return await records.CommitAsync(scope, op, "ministry.private_reason", id, [old is null ? RecordChange.Create("reason", "ministryPrivateReason", item) : RecordChange.Replace("reason", "ministryPrivateReason", item, Versions.Require(request.Version))], item, ct);
    }

    public async Task<Versioned<MinistryPrivateReason>> PrivateReasonAsync(string parish, string ministry, string id, CancellationToken ct)
    {
        var application = await ApplicationAsync(parish, ministry, id, ct);
        if (application.Value.Kind != "Leave")
            throw Missing();
        if (application.Value.ApplicantAccountId != actor.AccountId)
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        return await records.ReadAsync<MinistryPrivateReason>(new RecordScope { Area = RecordArea.PrivateCase, OwnerId = "ministry-leave:" + id }, "reason", ct) ?? throw Missing();
    }

    public async Task<Page<Versioned<MinistryMembership>>> RosterAsync(string parish, string ministry, int size, string? cursor, CancellationToken ct)
    {
        await RequireLeader(parish, ministry, ct);
        return await records.PageAsync<MinistryMembership>(Scope(parish), "ministryMembership", size, cursor, ct, new RecordCondition { Path = "ministryId", Comparison = "eq", Value = ministry });
    }
}
