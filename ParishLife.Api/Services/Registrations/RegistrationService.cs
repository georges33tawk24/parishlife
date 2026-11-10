// Purpose: Contains event registration, consent, capacity, receipts/refunds, and presence state transitions.
// Main functions: Scope, Op, Authorize, Fence, Get, Invalid, PolicyKey, RowKey, Event, RequireEligibleEvent, ViewedFormAsync, Participants, CapacityAvailable,
// ConfigureAsync, PolicyAsync, FormAsync, PolicyActionAsync, ReviseFormAsync, RegisterAsync, RegisterOwnAsync, OwnAsync,
// CancelOwnAsync, GetAsync, Registration, ListAsync, ActAsync, AmendAsync, Optional, ValidateCollectors, ValidateEligibility,
// ReceiptAsync, RequestRefundAsync, RefundActionAsync, MovementsAsync, RefundsAsync, Door, DoorListAsync, DoorRegistrationAsync,
// CashierListAsync, CashierRegistrationAsync, ApplicantFormAsync, PresenceAsync, PresentAsync and authorized notification-outcome projections.
// Decision notices are committed with the registration only for a proven self-applicant; office recorders never become guessed recipients.
// Every staff path requires current MFA, and registration changes fence the parish root and the event policy,
// so concurrent seat allocation and stale authority fail instead of committing.

using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Registrations;

public sealed class RegistrationService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, IAccountDirectory accounts,
    MfaAccountAccess proof, MinistryAccess own, NotificationService notifications, NotificationOutcomeReader outcomes, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new RecordScope
    {
        Area = RecordArea.Parish,
        OwnerId = parish
    };
    private Operation Op(Guid id, object request, string target) => actor.CreateOperation(id, request, clock, target);
    private async Task<Versioned<Parish>> Authorize(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        return root;
    }

    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<T>> Get<T>(string parish, string id, CancellationToken ct) => await records.ReadAsync<T>(Scope(parish), id, ct) ?? throw new DomainException("registration_resource_unavailable", "The requested event registration resource is unavailable.", FailureKind.NotFound);
    private static DomainException Invalid(string message) => new("registration_state", message, FailureKind.Conflict);
    private static string PolicyKey(string eventId) => "registrationPolicy:" + eventId;
    private static string RowKey(string id) => "registration:" + id;
    // One deterministic registration per person and event, shared by office and self-service paths.
    private static string RegistrationId(string eventId, string person)
        => new Guid(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(eventId + ":" + person)).AsSpan(0, 16)).ToString("N");
    private async Task<Versioned<CalendarEvent>> Event(string parish, string id, CancellationToken ct)
    {
        var item = await Get<CalendarEvent>(parish, "event:" + id, ct);
        if (item.Value.Status == "Cancelled")
            throw Invalid("This event is cancelled.");
        return item;
    }

    private static void RequireEligibleEvent(CalendarEvent item)
    {
        if (item.Kind != "ParishActivity" || item.Visibility is not ("Parish" or "Public")
            || item.SourceType is not null || item.SourceId is not null || item.MinistryId is not null || item.ClergyAccountIds?.Length > 0)
            throw new DomainException("event_not_eligible", "Registration is available for parish or public manual parish activities only.", FailureKind.Conflict);
    }

    private async Task<RegistrationForm> ViewedFormAsync(string parish, RegistrationPolicy policy, Guid viewedFormId, CancellationToken ct)
    {
        if (Guard.Id(viewedFormId) != policy.FormVersionId)
            throw new DomainException("registration_form_changed", "The registration form has changed. Read the current form and review its questions before submitting again.", FailureKind.Conflict);
        var form = await Get<RegistrationForm>(parish, "registrationForm:" + policy.FormVersionId, ct);
        if (form.Value.EventId != policy.EventId)
            throw Invalid("This form belongs to a different event.");
        return form.Value;
    }

    private async Task<IReadOnlyList<Versioned<EventRegistration>>> Participants(string parish, string eventId, CancellationToken ct) => await records.CollectAsync<EventRegistration>(Scope(parish), "registration", ct, 5000, new RecordCondition { Path = "eventId", Comparison = "eq", Value = eventId });
    private async Task<bool> CapacityAvailable(string parish, RegistrationPolicy policy, bool transport, string? except, CancellationToken ct)
    {
        var active = (await Participants(parish, policy.EventId, ct)).Select(x => x.Value).Where(x => x.Id != except && RegistrationRules.ConsumesSeat(x, clock.GetUtcNow())).ToArray();
        return active.Length < policy.Capacity && (!transport || active.Count(x => x.Transport) < policy.TransportCapacity);
    }

    public async Task<RegistrationPolicy> ConfigureAsync(string parish, string eventId, ConfigureRegistrationDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = Op(request.OperationId, request, "registration-policy:" + eventId);
        if (await records.ReplayAsync<RegistrationPolicy>(Scope(parish), op, ct) is { } replay)
            return replay;
        var occurrence = await Event(parish, eventId, ct);
        // Registration applies to manual parish activities; source-owned meetings use RSVP and appointments/blocks are private.
        RequireEligibleEvent(occurrence.Value);
        if (request.Capacity is < 1 or > 4000 || request.TransportCapacity < 0 || request.TransportCapacity > request.Capacity || request.MinimumAge is < 0 or > 120 || request.MaximumAge is < 0 or > 120 || request.MaximumAge < request.MinimumAge || request.ChildAgeThreshold is < 1 or > 25 || request.Fields is null || request.DoorAccountIds is null || request.DoorAccountIds.Length > 40)
            throw new DomainException("invalid_registration_policy", "Use bounded capacity, explicit age/guardian policy and bounded form/operator lists.");
        RegistrationRules.Money(request.Fee, Guard.Text(request.Currency, "Currency", 3), request.Precision);
        RegistrationRules.ValidateFields(request.Fields);
        if (request.ConsentRequired)
            Guard.Text(request.ConsentText, "Consent wording", 10000);
        foreach (var account in request.DoorAccountIds.Select(Guard.Id).Distinct())
            if (!await accounts.IsActiveVerifiedAsync(account, ct))
                throw new DomainException("door_account_unavailable", "Door operators must be active verified accounts.");
        var policy = new RegistrationPolicy
        {
            Id = eventId,
            ParishId = parish,
            EventId = eventId,
            FormVersionId = op.Id,
            Status = "Draft",
            Capacity = request.Capacity,
            TransportCapacity = request.TransportCapacity,
            Fee = request.Fee,
            Currency = request.Currency,
            Precision = request.Precision,
            WaitlistAllowed = request.WaitlistAllowed,
            MinimumAge = request.MinimumAge,
            MaximumAge = request.MaximumAge,
            ChildAgeThreshold = request.ChildAgeThreshold,
            ConsentRequired = request.ConsentRequired,
            ConsentText = request.ConsentText,
            DoorAccountIds = request.DoorAccountIds.Select(Guard.Id).Distinct().ToArray(),
            CreatedAt = op.At,
            CreatedBy = actor.AccountId
        };
        var form = new RegistrationForm
        {
            Id = op.Id,
            EventId = eventId,
            Fields = request.Fields,
            CreatedAt = op.At,
            CreatedBy = actor.AccountId
        };
        return await records.CommitAsync(Scope(parish), op, "registration.configure", eventId, [Fence(root), RecordChange.Create(PolicyKey(eventId), "registrationPolicy", policy), RecordChange.Create("registrationForm:" + op.Id, "registrationForm", form), RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version)], policy, ct);
    }

    public async Task<Versioned<RegistrationPolicy>> PolicyAsync(string parish, string eventId, CancellationToken ct)
    {
        await Authorize(parish, Permissions.RegistrationsManage, ct);
        return await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
    }

    public async Task<RegistrationForm> FormAsync(string parish, string eventId, string formId, CancellationToken ct)
    {
        await Authorize(parish, Permissions.RegistrationsManage, ct);
        var form = await Get<RegistrationForm>(parish, "registrationForm:" + formId, ct);
        if (form.Value.EventId != eventId)
            throw Invalid("This form belongs to a different event.");
        return form.Value;
    }

    public async Task<RegistrationPolicy> PolicyActionAsync(string parish, string eventId, RegistrationPolicyActionDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = Op(request.OperationId, request, "registration-policy:" + eventId);
        if (await records.ReplayAsync<RegistrationPolicy>(Scope(parish), op, ct) is { } replay)
            return replay;
        var row = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        var occurrence = await Event(parish, eventId, ct);
        if (request.Action == "open")
            RequireEligibleEvent(occurrence.Value);
        var status = request.Action switch
        {
            "open" when occurrence.Value.Status == "Confirmed" && occurrence.Value.StartsAt > clock.GetUtcNow() => "Open",
            "close" => "Closed",
            _ => throw Invalid("Opening requires a future confirmed event; use open or close.")
        };
        var result = new RegistrationPolicy
        {
            Id = row.Value.Id,
            ParishId = row.Value.ParishId,
            EventId = row.Value.EventId,
            FormVersionId = row.Value.FormVersionId,
            Status = status,
            Capacity = row.Value.Capacity,
            TransportCapacity = row.Value.TransportCapacity,
            Fee = row.Value.Fee,
            Currency = row.Value.Currency,
            Precision = row.Value.Precision,
            WaitlistAllowed = row.Value.WaitlistAllowed,
            MinimumAge = row.Value.MinimumAge,
            MaximumAge = row.Value.MaximumAge,
            ChildAgeThreshold = row.Value.ChildAgeThreshold,
            ConsentRequired = row.Value.ConsentRequired,
            ConsentText = row.Value.ConsentText,
            DoorAccountIds = row.Value.DoorAccountIds,
            CreatedAt = row.Value.CreatedAt,
            CreatedBy = row.Value.CreatedBy
        };
        return await records.CommitAsync(Scope(parish), op, "registration." + request.Action, eventId, [Fence(root), RecordChange.Replace(PolicyKey(eventId), "registrationPolicy", result, Versions.Require(request.Version)), RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version)], result, ct);
    }

    public async Task<RegistrationPolicy> ReviseFormAsync(string parish, string eventId, ReviseFormDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = Op(request.OperationId, request, "registration-form:" + eventId);
        if (await records.ReplayAsync<RegistrationPolicy>(Scope(parish), op, ct) is { } replay)
            return replay;
        var row = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        if (request.Fields is null)
            throw new DomainException("fields_required", "Form fields are required.");
        RegistrationRules.ValidateFields(request.Fields);
        var result = new RegistrationPolicy
        {
            Id = row.Value.Id,
            ParishId = row.Value.ParishId,
            EventId = row.Value.EventId,
            FormVersionId = op.Id,
            Status = row.Value.Status,
            Capacity = row.Value.Capacity,
            TransportCapacity = row.Value.TransportCapacity,
            Fee = row.Value.Fee,
            Currency = row.Value.Currency,
            Precision = row.Value.Precision,
            WaitlistAllowed = row.Value.WaitlistAllowed,
            MinimumAge = row.Value.MinimumAge,
            MaximumAge = row.Value.MaximumAge,
            ChildAgeThreshold = row.Value.ChildAgeThreshold,
            ConsentRequired = row.Value.ConsentRequired,
            ConsentText = row.Value.ConsentText,
            DoorAccountIds = row.Value.DoorAccountIds,
            CreatedAt = row.Value.CreatedAt,
            CreatedBy = row.Value.CreatedBy
        };
        return await records.CommitAsync(Scope(parish), op, "registration.revise_form", eventId, [Fence(root), RecordChange.Replace(PolicyKey(eventId), "registrationPolicy", result, Versions.Require(request.Version)), RecordChange.Create("registrationForm:" + op.Id, "registrationForm", new RegistrationForm { Id = op.Id, EventId = eventId, Fields = request.Fields, CreatedAt = op.At, CreatedBy = actor.AccountId })], result, ct);
    }

    public async Task<EventRegistration> RegisterAsync(string parish, string eventId, RegisterParticipantDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = Op(request.OperationId, request, "registration:" + eventId);
        if (await records.ReplayAsync<EventRegistration>(Scope(parish), op, ct) is { } replay)
            return (await Registration(parish, eventId, replay.Id, ct)).Value;
        var policy = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        var occurrence = await Event(parish, eventId, ct);
        RequireEligibleEvent(occurrence.Value);
        if (policy.Value.Status != "Open" || occurrence.Value.StartsAt <= clock.GetUtcNow())
            throw Invalid("Registration is closed for this event.");
        var person = await Get<Person>(parish, "person:" + Guard.Id(request.PersonId), ct);
        if (person.Value.Archived)
            throw Invalid("Restore or review the archived person before registering.");
        var form = await ViewedFormAsync(parish, policy.Value, request.FormVersionId, ct);
        if (request.Answers is null || request.Collectors is null)
            throw new DomainException("participant_input_required", "Answers and collector lists are required.");
        RegistrationRules.ValidateAnswers(form.Fields, request.Answers);
        ValidateCollectors(request.Collectors);
        var id = RegistrationId(eventId, person.Value.Id);
        var item = new EventRegistration
        {
            Id = id,
            ParishId = parish,
            EventId = eventId,
            PersonId = person.Value.Id,
            Origin = "Office",
            FormVersionId = form.Id,
            Status = "Submitted",
            Transport = request.Transport,
            Answers = request.Answers,
            ConsentEvidence = Optional(request.ConsentEvidence),
            GuardianAuthorityEvidence = Optional(request.GuardianAuthorityEvidence),
            Collectors = request.Collectors,
            IndependentDeparture = request.IndependentDeparture,
            Fee = policy.Value.Fee,
            Currency = policy.Value.Currency,
            Precision = policy.Value.Precision,
            Received = 0,
            Refunded = 0,
            CreatedAt = op.At,
            CreatedBy = actor.AccountId,
            NotificationWorkIds = []
        };
        return await records.CommitAsync(Scope(parish), op, "registration.submit", id, [Fence(root), RecordChange.Create(RowKey(id), "registration", item), RecordChange.Replace(PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version), RecordChange.Replace("person:" + person.Value.Id, "person", person.Value, person.Version), RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version)], item, ct);
    }

    public async Task<Versioned<EventRegistration>> GetAsync(string parish, string eventId, string id, CancellationToken ct)
    {
        await Authorize(parish, Permissions.RegistrationsManage, ct);
        return await Registration(parish, eventId, id, ct);
    }

    private async Task<Versioned<EventRegistration>> Registration(string parish, string eventId, string id, CancellationToken ct)
    {
        var row = await Get<EventRegistration>(parish, RowKey(id), ct);
        if (row.Value.EventId != eventId)
            throw new DomainException("registration_resource_unavailable", "The requested registration is unavailable.", FailureKind.NotFound);
        return row;
    }

    public async Task<Page<Versioned<EventRegistration>>> ListAsync(string parish, string eventId, int size, string? cursor, CancellationToken ct)
    {
        await Authorize(parish, Permissions.RegistrationsManage, ct);
        return await records.PageAsync<EventRegistration>(Scope(parish), "registration", size, cursor, ct, new RecordCondition { Path = "eventId", Comparison = "eq", Value = eventId });
    }

    public async Task<EventRegistration> ActAsync(string parish, string eventId, string id, RegistrationActionDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = Op(request.OperationId, request, "registration-action:" + id);
        if (await records.ReplayAsync<EventRegistration>(Scope(parish), op, ct) is not null)
            return (await Registration(parish, eventId, id, ct)).Value;
        var row = await Registration(parish, eventId, id, ct);
        var item = row.Value;
        var policy = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        var changes = new List<RecordChange> { Fence(root) };
        Guard.Text(request.Reason, "Reason", 2000);
        if (request.Action == "cancel")
        {
            if (item.Presence == "Present")
                throw Invalid("Check the participant out before cancelling registration.");
            item = new EventRegistration
            {
                Id = item.Id,
                Origin = item.Origin,
                ParishId = item.ParishId,
                EventId = item.EventId,
                PersonId = item.PersonId,
                FormVersionId = item.FormVersionId,
                Status = "Cancelled",
                Transport = item.Transport,
                Answers = item.Answers,
                ConsentEvidence = item.ConsentEvidence,
                GuardianAuthorityEvidence = item.GuardianAuthorityEvidence,
                Collectors = item.Collectors,
                IndependentDeparture = item.IndependentDeparture,
                Fee = item.Fee,
                Currency = item.Currency,
                Precision = item.Precision,
                Received = item.Received,
                Refunded = item.Refunded,
                CreatedAt = item.CreatedAt,
                CreatedBy = item.CreatedBy, NotificationWorkIds = item.NotificationWorkIds,
                OfferUntil = null,
                Presence = item.Presence,
                LastPresenceAt = item.LastPresenceAt
            };
        }
        else
        {
            var occurrence = await Event(parish, eventId, ct);
            RequireEligibleEvent(occurrence.Value);
            if (policy.Value.Status != "Open" || occurrence.Value.StartsAt <= clock.GetUtcNow())
                throw Invalid("Registration decisions require an open future event.");
            var person = await Get<Person>(parish, "person:" + item.PersonId, ct);
            if (request.Action is "reserve" or "confirm" or "offer")
                ValidateEligibility(item, policy.Value, person.Value, occurrence.Value);
            var status = RegistrationRules.EffectiveStatus(item, clock.GetUtcNow());
            if (request.Action == "reinstate" && status == "Cancelled")
                item = new EventRegistration
                {
                    Id = item.Id,
                    Origin = item.Origin,
                    ParishId = item.ParishId,
                    EventId = item.EventId,
                    PersonId = item.PersonId,
                    FormVersionId = item.FormVersionId,
                    Status = "Submitted",
                    Transport = item.Transport,
                    Answers = item.Answers,
                    ConsentEvidence = item.ConsentEvidence,
                    GuardianAuthorityEvidence = item.GuardianAuthorityEvidence,
                    Collectors = item.Collectors,
                    IndependentDeparture = item.IndependentDeparture,
                    Fee = item.Fee,
                    Currency = item.Currency,
                    Precision = item.Precision,
                    Received = item.Received,
                    Refunded = item.Refunded,
                    CreatedAt = item.CreatedAt,
                    CreatedBy = item.CreatedBy, NotificationWorkIds = item.NotificationWorkIds,
                    OfferUntil = null,
                    Presence = "NotArrived",
                    LastPresenceAt = item.LastPresenceAt
                };
            else if (request.Action is "reserve" or "confirm" or "offer")
            {
                if (request.Action == "offer" && status is not ("Waitlisted" or "OfferExpired") || request.Action == "reserve" && status != "Submitted" || request.Action == "confirm" && status is not ("Submitted" or "Reserved"))
                    throw Invalid("This registration action is not available in the current state.");
                if (!await CapacityAvailable(parish, policy.Value, item.Transport, item.Id, ct))
                {
                    if (!policy.Value.WaitlistAllowed || request.Action == "offer")
                        throw Invalid("Participant or transport capacity is full.");
                    item = new EventRegistration
                    {
                        Id = item.Id,
                        Origin = item.Origin,
                        ParishId = item.ParishId,
                        EventId = item.EventId,
                        PersonId = item.PersonId,
                        FormVersionId = item.FormVersionId,
                        Status = "Waitlisted",
                        Transport = item.Transport,
                        Answers = item.Answers,
                        ConsentEvidence = item.ConsentEvidence,
                        GuardianAuthorityEvidence = item.GuardianAuthorityEvidence,
                        Collectors = item.Collectors,
                        IndependentDeparture = item.IndependentDeparture,
                        Fee = item.Fee,
                        Currency = item.Currency,
                        Precision = item.Precision,
                        Received = item.Received,
                        Refunded = item.Refunded,
                        CreatedAt = item.CreatedAt,
                        CreatedBy = item.CreatedBy, NotificationWorkIds = item.NotificationWorkIds,
                        OfferUntil = null,
                        Presence = item.Presence,
                        LastPresenceAt = item.LastPresenceAt
                    };
                }
                else
                {
                    if (request.Action == "offer")
                    {
                        var earlier = (await Participants(parish, eventId, ct)).Select(x => x.Value).Where(x => x.Id != item.Id && RegistrationRules.EffectiveStatus(x, clock.GetUtcNow()) is "Waitlisted" or "OfferExpired" && (x.CreatedAt < item.CreatedAt || x.CreatedAt == item.CreatedAt && string.CompareOrdinal(x.Id, item.Id) < 0));
                        foreach (var candidate in earlier)
                            if (await CapacityAvailable(parish, policy.Value, candidate.Transport, candidate.Id, ct))
                                throw Invalid("Review the earlier waiting participant first.");
                    }

                    if (request.Action != "confirm" && (request.OfferUntil is null || Guard.Utc(request.OfferUntil.Value) <= clock.GetUtcNow() || request.OfferUntil >= occurrence.Value.StartsAt))
                        throw new DomainException("offer_deadline_required", "Set an explicit future offer deadline before the event.");
                    item = new EventRegistration
                    {
                        Id = item.Id,
                        Origin = item.Origin,
                        ParishId = item.ParishId,
                        EventId = item.EventId,
                        PersonId = item.PersonId,
                        FormVersionId = item.FormVersionId,
                        Status = request.Action == "confirm" ? "Confirmed" : "Reserved",
                        Transport = item.Transport,
                        Answers = item.Answers,
                        ConsentEvidence = item.ConsentEvidence,
                        GuardianAuthorityEvidence = item.GuardianAuthorityEvidence,
                        Collectors = item.Collectors,
                        IndependentDeparture = item.IndependentDeparture,
                        Fee = item.Fee,
                        Currency = item.Currency,
                        Precision = item.Precision,
                        Received = item.Received,
                        Refunded = item.Refunded,
                        CreatedAt = item.CreatedAt,
                        CreatedBy = item.CreatedBy, NotificationWorkIds = item.NotificationWorkIds,
                        OfferUntil = request.Action == "confirm" ? null : request.OfferUntil,
                        Presence = item.Presence,
                        LastPresenceAt = item.LastPresenceAt
                    };
                }
            }
            else
                throw new DomainException("invalid_registration_action", "Use reserve, confirm, offer, reinstate or cancel.");
            changes.Add(RecordChange.Replace("person:" + person.Value.Id, "person", person.Value, person.Version));
            changes.Add(RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version));
        }

        changes.Add(RecordChange.Replace(PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version));
        var recipient = await StageApplicantNoticeAsync(parish, item, op, changes, ct);
        changes.Add(RecordChange.Replace(RowKey(id), "registration", item, Versions.Require(request.Version)));
        var committed = await records.CommitAsync(Scope(parish), op, "registration." + request.Action, id, changes, item, ct, request.Reason);
        if (recipient is not null)
            await notifications.DispatchAsync(parish, recipient, "registration:" + op.Id, ct);
        return committed;
    }

    private async Task<string?> StageApplicantNoticeAsync(string parish, EventRegistration item, Operation op, List<RecordChange> changes, CancellationToken ct)
    {
        item.NotificationWorkIds = [];
        if (item.Origin != "Self" || !Guid.TryParse(item.CreatedBy, out var account) || account == Guid.Empty)
            return null;
        var applicant = Guard.Id(account);
        var linkKey = "personAccountLink:" + applicant;
        var claimKey = "personAccountClaim:" + item.PersonId;
        var link = await records.ReadAsync<PersonAccountLink>(Scope(parish), linkKey, ct);
        var claim = await records.ReadAsync<CommandResult>(Scope(parish), claimKey, ct);
        var person = await records.ReadAsync<Person>(Scope(parish), "person:" + item.PersonId, ct);
        if (link?.Value.Active != true || link.Value.AccountId != applicant || link.Value.ParishId != parish || link.Value.PersonId != item.PersonId
            || claim?.Value.Id != applicant || claim.Value.Status != "Linked" || person?.Value.Archived != false || person.Value.Id != item.PersonId || person.Value.ParishId != parish)
            return null;
        changes.Add(RecordChange.Replace(linkKey, "personAccountLink", link.Value, link.Version));
        changes.Add(RecordChange.Replace(claimKey, "personAccountClaim", claim.Value, claim.Version));
        if (!changes.Any(change => change.Id == "person:" + item.PersonId))
            changes.Add(RecordChange.Replace("person:" + item.PersonId, "person", person.Value, person.Version));
        var title = item.Status == "Reserved"
            ? "There is an update to your event registration. Review its response deadline."
            : "There is an update to your event registration.";
        var notice = notifications.StageRequired(parish, applicant, "registration.update", title,
            "/api/parishes/" + parish + "/calendar/events/" + item.EventId + "/registrations/mine",
            "registration:" + op.Id, "RegistrationApplicant", item.Id, op.At);
        changes.Add(notice);
        item.NotificationWorkIds = [((NotificationWork)notice.Value!).Id];
        return applicant;
    }

    public async Task<EventRegistration> AmendAsync(string parish, string eventId, string id, AmendParticipantDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = Op(request.OperationId, request, "registration-amend:" + id);
        if (await records.ReplayAsync<EventRegistration>(Scope(parish), op, ct) is not null)
            return (await Registration(parish, eventId, id, ct)).Value;
        var row = await Registration(parish, eventId, id, ct);
        var policy = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        var occurrence = await Event(parish, eventId, ct);
        RequireEligibleEvent(occurrence.Value);
        var person = await Get<Person>(parish, "person:" + row.Value.PersonId, ct);
        if (row.Value.Presence == "Present" || row.Value.Status == "Cancelled")
            throw Invalid("Amendments are unavailable for present or cancelled participants.");
        var form = await Get<RegistrationForm>(parish, "registrationForm:" + row.Value.FormVersionId, ct);
        if (request.Answers is null || request.Collectors is null)
            throw new DomainException("participant_input_required", "Answers and collector lists are required.");
        RegistrationRules.ValidateAnswers(form.Value.Fields, request.Answers);
        ValidateCollectors(request.Collectors);
        Guard.Text(request.Reason, "Amendment reason", 2000);
        var item = new EventRegistration
        {
            Id = row.Value.Id,
            Origin = row.Value.Origin,
            ParishId = row.Value.ParishId,
            EventId = row.Value.EventId,
            PersonId = row.Value.PersonId,
            FormVersionId = row.Value.FormVersionId,
            Status = row.Value.Status,
            Transport = request.Transport,
            Answers = request.Answers,
            ConsentEvidence = Optional(request.ConsentEvidence),
            GuardianAuthorityEvidence = Optional(request.GuardianAuthorityEvidence),
            Collectors = request.Collectors,
            IndependentDeparture = request.IndependentDeparture,
            Fee = row.Value.Fee,
            Currency = row.Value.Currency,
            Precision = row.Value.Precision,
            Received = row.Value.Received,
            Refunded = row.Value.Refunded,
            CreatedAt = row.Value.CreatedAt,
            CreatedBy = row.Value.CreatedBy, NotificationWorkIds = row.Value.NotificationWorkIds,
            OfferUntil = row.Value.OfferUntil,
            Presence = row.Value.Presence,
            LastPresenceAt = row.Value.LastPresenceAt
        };
        if (RegistrationRules.ConsumesSeat(item, clock.GetUtcNow()))
        {
            ValidateEligibility(item, policy.Value, person.Value, occurrence.Value);
            if (!await CapacityAvailable(parish, policy.Value, item.Transport, item.Id, ct))
                throw Invalid("The changed transport selection exceeds available capacity.");
        }

        return await records.CommitAsync(Scope(parish), op, "registration.amend", id, [Fence(root), RecordChange.Replace(RowKey(id), "registration", item, Versions.Require(request.Version)), RecordChange.Replace(PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version), RecordChange.Replace("person:" + person.Value.Id, "person", person.Value, person.Version), RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version)], item, ct, request.Reason);
    }

    private static string? Optional(string? value) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, "Evidence", 2000);
    private static void ValidateCollectors(AuthorizedCollector[] collectors)
    {
        if (collectors.Length > 10 || collectors.Select(x => x.Id).Distinct(StringComparer.Ordinal).Count() != collectors.Length)
            throw new DomainException("invalid_collectors", "Use up to ten distinct authorized collectors.");
        foreach (var collector in collectors)
        {
            Guard.Text(collector.Id, "Collector ID", 100);
            Guard.Text(collector.Name, "Collector name");
            Guard.Text(collector.AuthorityEvidence, "Collector authority evidence", 2000);
        }
    }

    private static void ValidateEligibility(EventRegistration item, RegistrationPolicy policy, Person person, CalendarEvent occurrence)
    {
        if (person.Archived || person.BirthDate is null)
            throw new DomainException("participant_age_required", "A current participant record and verified birth date are required before confirmation or admission.");
        var eventDate = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(occurrence.StartsAt, TimeZoneInfo.FindSystemTimeZoneById(occurrence.TimeZone)).DateTime);
        var age = RegistrationRules.AgeOn(person.BirthDate.Value, eventDate);
        if (age < 0 || age < policy.MinimumAge || age > policy.MaximumAge)
            throw new DomainException("participant_age_ineligible", "The participant does not satisfy the event age policy.");
        if (policy.ConsentRequired && string.IsNullOrWhiteSpace(item.ConsentEvidence))
            throw new DomainException("consent_required", "Record the actual required consent evidence.");
        if (age < policy.ChildAgeThreshold && (string.IsNullOrWhiteSpace(item.GuardianAuthorityEvidence) || item.Collectors.Length == 0 && !item.IndependentDeparture))
            throw new DomainException("guardian_authority_required", "Record verified guardian authority and an authorized collection or independent-departure arrangement.");
    }

    public async Task<RegistrationMovement> ReceiptAsync(string parish, string eventId, string id, RecordEventReceiptDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.FinanceEnter, ct);
        await access.RequireModuleAsync(parish, "finance", ct);
        var op = Op(request.OperationId, request, "registration-receipt:" + id);
        if (await records.ReplayAsync<RegistrationMovement>(Scope(parish), op, ct) is { } replay)
            return replay;
        var row = await Registration(parish, eventId, id, ct);
        var item = row.Value;
        RegistrationRules.Money(request.Amount, Guard.Text(request.Currency, "Currency", 3), item.Precision);
        if (item.Status == "Cancelled" || request.Amount <= 0 || request.Currency != item.Currency || request.Amount > item.Fee - item.Received + item.Refunded)
            throw new DomainException("invalid_event_receipt", "Record a positive actual payment in the fee currency, no greater than the outstanding balance, for an active registration.");
        if (Guard.Utc(request.OccurredAt) > clock.GetUtcNow())
            throw new DomainException("future_receipt", "An actual payment cannot occur in the future.");
        var receipt = new RegistrationMovement
        {
            Id = op.Id,
            RegistrationId = id,
            EventId = eventId,
            Kind = "CashReceived",
            Amount = request.Amount,
            Currency = item.Currency,
            Precision = item.Precision,
            EvidenceReference = Guard.Text(request.EvidenceReference, "Cash receipt evidence", 1000),
            OccurredAt = request.OccurredAt,
            RecordedAt = op.At,
            RecordedBy = actor.AccountId,
            ApprovedBy = null
        };
        return await records.CommitAsync(Scope(parish), op, "registration.cash_received", id, [Fence(root), RecordChange.Replace(RowKey(id), "registration", new EventRegistration { Id = item.Id, Origin = item.Origin, ParishId = item.ParishId, EventId = item.EventId, PersonId = item.PersonId, FormVersionId = item.FormVersionId, Status = item.Status, Transport = item.Transport, Answers = item.Answers, ConsentEvidence = item.ConsentEvidence, GuardianAuthorityEvidence = item.GuardianAuthorityEvidence, Collectors = item.Collectors, IndependentDeparture = item.IndependentDeparture, Fee = item.Fee, Currency = item.Currency, Precision = item.Precision, Received = item.Received + request.Amount, Refunded = item.Refunded, CreatedAt = item.CreatedAt, CreatedBy = item.CreatedBy, NotificationWorkIds = item.NotificationWorkIds, OfferUntil = item.OfferUntil, Presence = item.Presence, LastPresenceAt = item.LastPresenceAt }, Versions.Require(request.Version)), RecordChange.Create("registrationMovement:" + op.Id, "registrationMovement", receipt)], receipt, ct);
    }

    public async Task<RegistrationRefund> RequestRefundAsync(string parish, string eventId, string id, RequestEventRefundDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.FinanceEnter, ct);
        await access.RequireModuleAsync(parish, "finance", ct);
        var op = Op(request.OperationId, request, "registration-refund:" + id);
        if (await records.ReplayAsync<RegistrationRefund>(Scope(parish), op, ct) is { } replay)
            return replay;
        var row = await Registration(parish, eventId, id, ct);
        RegistrationRules.Money(request.Amount, row.Value.Currency, row.Value.Precision);
        var pending = (await records.CollectAsync<RegistrationRefund>(Scope(parish), "registrationRefund", ct, 5000, new RecordCondition { Path = "registrationId", Comparison = "eq", Value = id })).Where(x => x.Value.Status is "Requested" or "Approved").Sum(x => x.Value.Amount);
        if (request.Amount <= 0 || request.Amount + pending > row.Value.Received - row.Value.Refunded)
            throw Invalid("The refund exceeds actual unrefunded receipts after pending refund reservations.");
        var item = new RegistrationRefund
        {
            Id = op.Id,
            RegistrationId = id,
            Amount = request.Amount,
            Currency = row.Value.Currency,
            Status = "Requested",
            Reason = Guard.Text(request.Reason, "Refund reason", 2000),
            RequestedBy = actor.AccountId,
            RequestedAt = op.At
        };
        return await records.CommitAsync(Scope(parish), op, "registration.refund_request", id, [Fence(root), RecordChange.Replace(RowKey(id), "registration", row.Value, Versions.Require(request.Version)), RecordChange.Create("registrationRefund:" + op.Id, "registrationRefund", item)], item, ct);
    }

    public async Task<RegistrationRefund> RefundActionAsync(string parish, string eventId, string id, string refundId, DecideEventRefundDto request, CancellationToken ct)
    {
        var root = await Authorize(parish, request.Action == "record" ? Permissions.FinanceEnter : Permissions.FinanceApprove, ct);
        await access.RequireModuleAsync(parish, "finance", ct);
        var op = Op(request.OperationId, request, "registration-refund-decision:" + refundId);
        if (await records.ReplayAsync<RegistrationRefund>(Scope(parish), op, ct) is { } replay)
            return replay;
        var registration = await Registration(parish, eventId, id, ct);
        var row = await Get<RegistrationRefund>(parish, "registrationRefund:" + refundId, ct);
        if (row.Value.RegistrationId != id)
            throw Invalid("The refund belongs to another registration.");
        Guard.Text(request.Reason, "Decision reason", 2000);
        var item = row.Value;
        var changes = new List<RecordChange> { Fence(root) };
        if (request.Action is "approve" or "reject")
        {
            if (item.Status != "Requested" || item.RequestedBy == actor.AccountId)
                throw Invalid("A different authorized reviewer must decide the requested refund.");
            item = new RegistrationRefund
            {
                Id = item.Id,
                RegistrationId = item.RegistrationId,
                Amount = item.Amount,
                Currency = item.Currency,
                Status = request.Action == "approve" ? "Approved" : "Rejected",
                Reason = item.Reason,
                RequestedBy = item.RequestedBy,
                RequestedAt = item.RequestedAt,
                ApprovedBy = actor.AccountId,
                RecordedBy = item.RecordedBy
            };
        }
        else if (request.Action == "record")
        {
            if (item.Status != "Approved" || item.ApprovedBy == actor.AccountId || item.Amount > registration.Value.Received - registration.Value.Refunded)
                throw Invalid("Record an approved refund through an operator independent of its approver, within actual receipts.");
            if (request.OccurredAt is null || Guard.Utc(request.OccurredAt.Value) > clock.GetUtcNow())
                throw new DomainException("refund_date_required", "Record when the money was actually returned.");
            var movement = new RegistrationMovement
            {
                Id = op.Id,
                RegistrationId = id,
                EventId = eventId,
                Kind = "CashRefunded",
                Amount = item.Amount,
                Currency = item.Currency,
                Precision = registration.Value.Precision,
                EvidenceReference = Guard.Text(request.EvidenceReference, "Actual refund evidence", 1000),
                OccurredAt = request.OccurredAt.Value,
                RecordedAt = op.At,
                RecordedBy = actor.AccountId,
                ApprovedBy = item.ApprovedBy,
                RefundRequestId = item.Id
            };
            changes.Add(RecordChange.Create("registrationMovement:" + op.Id, "registrationMovement", movement));
            item = new RegistrationRefund
            {
                Id = item.Id,
                RegistrationId = item.RegistrationId,
                Amount = item.Amount,
                Currency = item.Currency,
                Status = "Recorded",
                Reason = item.Reason,
                RequestedBy = item.RequestedBy,
                RequestedAt = item.RequestedAt,
                ApprovedBy = item.ApprovedBy,
                RecordedBy = actor.AccountId
            };
        }
        else
            throw new DomainException("invalid_refund_action", "Use approve, reject or record.");
        changes.Add(RecordChange.Replace(RowKey(id), "registration", request.Action == "record" ? new EventRegistration { Id = registration.Value.Id, Origin = registration.Value.Origin, ParishId = registration.Value.ParishId, EventId = registration.Value.EventId, PersonId = registration.Value.PersonId, FormVersionId = registration.Value.FormVersionId, Status = registration.Value.Status, Transport = registration.Value.Transport, Answers = registration.Value.Answers, ConsentEvidence = registration.Value.ConsentEvidence, GuardianAuthorityEvidence = registration.Value.GuardianAuthorityEvidence, Collectors = registration.Value.Collectors, IndependentDeparture = registration.Value.IndependentDeparture, Fee = registration.Value.Fee, Currency = registration.Value.Currency, Precision = registration.Value.Precision, Received = registration.Value.Received, Refunded = registration.Value.Refunded + item.Amount, CreatedAt = registration.Value.CreatedAt, CreatedBy = registration.Value.CreatedBy, NotificationWorkIds = registration.Value.NotificationWorkIds, OfferUntil = registration.Value.OfferUntil, Presence = registration.Value.Presence, LastPresenceAt = registration.Value.LastPresenceAt } : registration.Value, registration.Version));
        changes.Add(RecordChange.Replace("registrationRefund:" + refundId, "registrationRefund", item, Versions.Require(request.Version)));
        return await records.CommitAsync(Scope(parish), op, "registration.refund_" + request.Action, id, changes, item, ct, request.Reason);
    }

    public async Task<Page<Versioned<RegistrationMovement>>> MovementsAsync(string parish, string eventId, string id, int size, string? cursor, CancellationToken ct)
    {
        await Authorize(parish, Permissions.FinanceRead, ct);
        await access.RequireModuleAsync(parish, "finance", ct);
        _ = await Registration(parish, eventId, id, ct);
        return await records.PageAsync<RegistrationMovement>(Scope(parish), "registrationMovement", size, cursor, ct, new RecordCondition { Path = "registrationId", Comparison = "eq", Value = id });
    }

    public async Task<Page<Versioned<RegistrationRefund>>> RefundsAsync(string parish, string eventId, string id, int size, string? cursor, CancellationToken ct)
    {
        await Authorize(parish, Permissions.FinanceRead, ct);
        await access.RequireModuleAsync(parish, "finance", ct);
        _ = await Registration(parish, eventId, id, ct);
        return await records.PageAsync<RegistrationRefund>(Scope(parish), "registrationRefund", size, cursor, ct, new RecordCondition { Path = "registrationId", Comparison = "eq", Value = id });
    }

    private async Task<(Versioned<Parish> Root, Versioned<RegistrationPolicy> Policy)> Door(string parish, string eventId, CancellationToken ct)
    {
        var root = await Authorize(parish, Permissions.CheckIn, ct);
        var policy = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        if (!policy.Value.DoorAccountIds.Contains(actor.AccountId, StringComparer.Ordinal))
            throw new DomainException("event_assignment_required", "An explicit assignment to this event is required.", FailureKind.Forbidden);
        return (root, policy);
    }

    public async Task<Page<Versioned<DoorRegistrationDto>>> DoorListAsync(string parish, string eventId, int size, string? cursor, CancellationToken ct)
    {
        await Door(parish, eventId, ct);
        var page = await records.PageAsync<EventRegistration>(Scope(parish), "registration", size, cursor, ct,
            new RecordCondition { Path = "eventId", Comparison = "eq", Value = eventId },
            new RecordCondition { Path = "status", Comparison = "eq", Value = "Confirmed" });
        var items = new List<Versioned<DoorRegistrationDto>>();
        foreach (var row in page.Items)
            items.Add(new Versioned<DoorRegistrationDto> { Version = row.Version, Value = await DoorViewAsync(parish, row.Value, ct) });
        return new Page<Versioned<DoorRegistrationDto>> { Items = items.ToArray(), ContinuationToken = page.ContinuationToken };
    }

    public async Task<Versioned<DoorRegistrationDto>> DoorRegistrationAsync(string parish, string eventId, string id, CancellationToken ct)
    {
        await Door(parish, eventId, ct);
        var row = await Registration(parish, eventId, id, ct);
        if (row.Value.Status != "Confirmed")
            throw new DomainException("registration_resource_unavailable", "The requested confirmed participant is unavailable.", FailureKind.NotFound);
        return new Versioned<DoorRegistrationDto> { Version = row.Version, Value = await DoorViewAsync(parish, row.Value, ct) };
    }

    private async Task<DoorRegistrationDto> DoorViewAsync(string parish, EventRegistration item, CancellationToken ct)
    {
        var person = await Get<Person>(parish, "person:" + item.PersonId, ct);
        return new DoorRegistrationDto
        {
            Id = item.Id, EventId = item.EventId, DisplayName = person.Value.GivenName + " " + person.Value.FamilyName,
            Status = item.Status, Presence = item.Presence, LastPresenceAt = item.LastPresenceAt, IndependentDeparture = item.IndependentDeparture,
            Collectors = item.Collectors.Select(x => new DoorCollectorDto { Id = x.Id, Name = x.Name }).ToArray()
        };
    }

    public async Task<Page<Versioned<CashierRegistrationDto>>> CashierListAsync(string parish, string eventId, int size, string? cursor, CancellationToken ct)
    {
        await Authorize(parish, Permissions.FinanceEnter, ct);
        await access.RequireModuleAsync(parish, "finance", ct);
        var page = await records.PageAsync<EventRegistration>(Scope(parish), "registration", size, cursor, ct,
            new RecordCondition { Path = "eventId", Comparison = "eq", Value = eventId });
        var items = new List<Versioned<CashierRegistrationDto>>();
        foreach (var row in page.Items)
            items.Add(new Versioned<CashierRegistrationDto> { Version = row.Version, Value = await CashierViewAsync(parish, row.Value, ct) });
        return new Page<Versioned<CashierRegistrationDto>> { Items = items.ToArray(), ContinuationToken = page.ContinuationToken };
    }

    public async Task<Versioned<CashierRegistrationDto>> CashierRegistrationAsync(string parish, string eventId, string id, CancellationToken ct)
    {
        await Authorize(parish, Permissions.FinanceEnter, ct);
        await access.RequireModuleAsync(parish, "finance", ct);
        var row = await Registration(parish, eventId, id, ct);
        return new Versioned<CashierRegistrationDto> { Version = row.Version, Value = await CashierViewAsync(parish, row.Value, ct) };
    }

    private async Task<CashierRegistrationDto> CashierViewAsync(string parish, EventRegistration item, CancellationToken ct)
    {
        var person = await Get<Person>(parish, "person:" + item.PersonId, ct);
        return new CashierRegistrationDto
        {
            Id = item.Id, EventId = item.EventId, DisplayName = person.Value.GivenName + " " + person.Value.FamilyName,
            Status = RegistrationRules.EffectiveStatus(item, clock.GetUtcNow()), Fee = item.Fee, Currency = item.Currency, Precision = item.Precision,
            Received = item.Received, Refunded = item.Refunded, Outstanding = item.Fee - item.Received + item.Refunded
        };
    }

    public async Task<PresenceChange> PresenceAsync(string parish, string eventId, string id, RecordPresenceDto request, CancellationToken ct)
    {
        var (root, policy) = await Door(parish, eventId, ct);
        var op = Op(request.OperationId, request, "event-presence:" + id);
        if (await records.ReplayAsync<PresenceChange>(Scope(parish), op, ct) is { } replay)
            return replay;
        var row = await Registration(parish, eventId, id, ct);
        var item = row.Value;
        var occurrence = await Event(parish, eventId, ct);
        if (request.Action is "arrive" or "reenter")
            RequireEligibleEvent(occurrence.Value);
        var person = await Get<Person>(parish, "person:" + item.PersonId, ct);
        if (item.Status != "Confirmed")
            throw Invalid("Only confirmed participants may use the event arrival process.");
        ValidateEligibility(item, policy.Value, person.Value, occurrence.Value);
        if (Guard.Utc(request.OccurredAt) > clock.GetUtcNow() || request.OccurredAt < occurrence.Value.StartsAt.AddHours(-4) || request.OccurredAt > occurrence.Value.EndsAt.AddHours(4) || request.OccurredAt < item.LastPresenceAt)
            throw new DomainException("invalid_presence_time", "The actual time must follow the previous presence record and fall within the event operating window.");
        if (clock.GetUtcNow() - request.OccurredAt > TimeSpan.FromMinutes(15))
            Guard.Text(request.PaperReason, "Paper entry reason", 2000);
        if (request.Action == "arrive" && item.Presence == "NotArrived" || request.Action == "reenter" && item.Presence == "Departed")
            item = new EventRegistration
            {
                Id = item.Id,
                Origin = item.Origin,
                ParishId = item.ParishId,
                EventId = item.EventId,
                PersonId = item.PersonId,
                FormVersionId = item.FormVersionId,
                Status = item.Status,
                Transport = item.Transport,
                Answers = item.Answers,
                ConsentEvidence = item.ConsentEvidence,
                GuardianAuthorityEvidence = item.GuardianAuthorityEvidence,
                Collectors = item.Collectors,
                IndependentDeparture = item.IndependentDeparture,
                Fee = item.Fee,
                Currency = item.Currency,
                Precision = item.Precision,
                Received = item.Received,
                Refunded = item.Refunded,
                CreatedAt = item.CreatedAt,
                CreatedBy = item.CreatedBy, NotificationWorkIds = item.NotificationWorkIds,
                OfferUntil = item.OfferUntil,
                Presence = "Present",
                LastPresenceAt = request.OccurredAt
            };
        else if (request.Action == "checkout" && item.Presence == "Present")
        {
            if (!item.IndependentDeparture)
            {
                if (request.CollectorId is null || !item.Collectors.Any(x => x.Id == request.CollectorId))
                    throw new DomainException("collector_not_authorized", "The collector must have verified recorded authority; no administrator override is available.", FailureKind.Forbidden);
                Guard.Text(request.VerificationEvidence, "Real-world collector verification evidence", 2000);
            }

            item = new EventRegistration
            {
                Id = item.Id,
                Origin = item.Origin,
                ParishId = item.ParishId,
                EventId = item.EventId,
                PersonId = item.PersonId,
                FormVersionId = item.FormVersionId,
                Status = item.Status,
                Transport = item.Transport,
                Answers = item.Answers,
                ConsentEvidence = item.ConsentEvidence,
                GuardianAuthorityEvidence = item.GuardianAuthorityEvidence,
                Collectors = item.Collectors,
                IndependentDeparture = item.IndependentDeparture,
                Fee = item.Fee,
                Currency = item.Currency,
                Precision = item.Precision,
                Received = item.Received,
                Refunded = item.Refunded,
                CreatedAt = item.CreatedAt,
                CreatedBy = item.CreatedBy, NotificationWorkIds = item.NotificationWorkIds,
                OfferUntil = item.OfferUntil,
                Presence = "Departed",
                LastPresenceAt = request.OccurredAt
            };
        }
        else
            throw Invalid("Use arrive for a first arrival, reenter after departure, or checkout for a present participant.");
        var change = new PresenceChange
        {
            Id = op.Id,
            RegistrationId = id,
            EventId = eventId,
            Action = request.Action,
            OccurredAt = request.OccurredAt,
            RecordedAt = op.At,
            RecordedBy = actor.AccountId,
            CollectorId = request.CollectorId,
            VerificationEvidence = Optional(request.VerificationEvidence),
            PaperReason = Optional(request.PaperReason)
        };
        return await records.CommitAsync(Scope(parish), op, "registration.presence_" + request.Action, id, [Fence(root), RecordChange.Replace(RowKey(id), "registration", item, Versions.Require(request.Version)), RecordChange.Create("presence:" + op.Id, "presence", change), RecordChange.Replace(PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version), RecordChange.Replace("person:" + person.Value.Id, "person", person.Value, person.Version), RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version)], change, ct);
    }

    public async Task<PresentRoster> PresentAsync(string parish, string eventId, CancellationToken ct)
    {
        await Door(parish, eventId, ct);
        var asOf = clock.GetUtcNow();
        var entries = new List<RosterEntry>();
        foreach (var row in (await Participants(parish, eventId, ct)).Where(x => x.Value.Presence == "Present"))
        {
            var person = await Get<Person>(parish, "person:" + row.Value.PersonId, ct);
            entries.Add(new RosterEntry { RegistrationId = row.Value.Id, PersonId = person.Value.Id, DisplayName = person.Value.GivenName + " " + person.Value.FamilyName, Presence = row.Value.Presence, LastPresenceAt = row.Value.LastPresenceAt });
        }

        return new PresentRoster
        {
            EventId = eventId,
            AsOf = asOf,
            Coverage = "Recorded present participants for this event only. This is not a census of everyone in the building; concurrent changes may occur during generation.",
            Entries = entries.ToArray()
        };
    }

    public async Task<RegistrationApplicantFormDto> ApplicantFormAsync(string parish, string eventId, CancellationToken ct)
    {
        await own.OwnLinkAsync(parish, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        var policy = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        var occurrence = await Event(parish, eventId, ct);
        RequireEligibleEvent(occurrence.Value);
        if (policy.Value.Status != "Open" || occurrence.Value.StartsAt <= clock.GetUtcNow())
            throw Invalid("Registration is closed for this event.");
        var form = await Get<RegistrationForm>(parish, "registrationForm:" + policy.Value.FormVersionId, ct);
        if (form.Value.EventId != eventId)
            throw Invalid("This form belongs to a different event.");
        return new RegistrationApplicantFormDto
        {
            EventId = eventId, FormVersionId = form.Value.Id, Fields = form.Value.Fields, Fee = policy.Value.Fee,
            Currency = policy.Value.Currency, Precision = policy.Value.Precision, MinimumAge = policy.Value.MinimumAge,
            MaximumAge = policy.Value.MaximumAge, ConsentRequired = policy.Value.ConsentRequired, ConsentText = policy.Value.ConsentText
        };
    }

    public async Task<EventRegistrationDto> RegisterOwnAsync(string parish, string eventId, RegisterOwnDto request, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        var root = await own.RootAsync(parish, ct);
        var op = Op(request.OperationId, request, "registration-own:" + eventId);
        if (await records.ReplayAsync<EventRegistration>(Scope(parish), op, ct) is { } replay)
            return await ProjectAsync((await Registration(parish, eventId, replay.Id, ct)).Value, false, ct);
        var policy = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        var occurrence = await Event(parish, eventId, ct);
        RequireEligibleEvent(occurrence.Value);
        if (policy.Value.Status != "Open" || occurrence.Value.StartsAt <= clock.GetUtcNow())
            throw Invalid("Registration is closed for this event.");
        var person = await Get<Person>(parish, "person:" + link.Value.PersonId, ct);
        if (person.Value.Archived)
            throw Invalid("Ask the parish office to review your record before registering.");
        var form = await ViewedFormAsync(parish, policy.Value, request.FormVersionId, ct);
        if (request.Answers is null)
            throw new DomainException("participant_input_required", "Answers are required.");
        RegistrationRules.ValidateAnswers(form.Fields, request.Answers);
        var id = RegistrationId(eventId, person.Value.Id);
        if (await records.ReadAsync<EventRegistration>(Scope(parish), RowKey(id), ct) is not null)
            throw Invalid("You already have a registration for this event; the office can reinstate a cancelled one.");
        // Self-registration only submits. Capacity, eligibility, guardian arrangements and confirmation stay with the office path.
        var item = new EventRegistration
        {
            Id = id, ParishId = parish, EventId = eventId, PersonId = person.Value.Id, Origin = "Self", FormVersionId = form.Id,
            Status = "Submitted", Transport = request.Transport, Answers = request.Answers, ConsentEvidence = Optional(request.ConsentEvidence),
            Collectors = [], Fee = policy.Value.Fee, Currency = policy.Value.Currency, Precision = policy.Value.Precision,
            CreatedAt = op.At, CreatedBy = actor.AccountId, NotificationWorkIds = []
        };
        var result = await records.CommitAsync(Scope(parish), op, "registration.submit_own", id,
            [Fence(root), RecordChange.Create(RowKey(id), "registration", item), RecordChange.Replace(PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version),
             RecordChange.Replace("person:" + person.Value.Id, "person", person.Value, person.Version), RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version)],
            item, ct);
        return await ProjectAsync(result, false, ct);
    }

    public async Task<Versioned<EventRegistrationDto>> OwnAsync(string parish, string eventId, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        var row = await records.ReadAsync<EventRegistration>(Scope(parish), RowKey(RegistrationId(eventId, link.Value.PersonId)), ct);
        if (row is null || row.Value.EventId != eventId || row.Value.PersonId != link.Value.PersonId)
            throw new DomainException("registration_resource_unavailable", "The requested registration is unavailable.", FailureKind.NotFound);
        return new Versioned<EventRegistrationDto> { Version = row.Version, Value = await ProjectAsync(row.Value, false, ct) };
    }

    public async Task<EventRegistrationDto> CancelOwnAsync(string parish, string eventId, CancelOwnRegistrationDto request, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        var root = await own.RootAsync(parish, ct);
        var op = Op(request.OperationId, request, "registration-own-cancel:" + eventId);
        if (await records.ReplayAsync<EventRegistration>(Scope(parish), op, ct) is { } replay)
            return await ProjectAsync((await Registration(parish, eventId, replay.Id, ct)).Value, false, ct);
        var id = RegistrationId(eventId, link.Value.PersonId);
        var row = await Registration(parish, eventId, id, ct);
        if (row.Value.PersonId != link.Value.PersonId)
            throw new DomainException("registration_resource_unavailable", "The requested registration is unavailable.", FailureKind.NotFound);
        if (row.Value.Status == "Cancelled" || row.Value.Presence == "Present")
            throw Invalid("Only an active registration before arrival can be cancelled.");
        Guard.Text(request.Reason, "Cancellation reason", 2000);
        var policy = await Get<RegistrationPolicy>(parish, PolicyKey(eventId), ct);
        var item = row.Value;
        item.Status = "Cancelled";
        item.OfferUntil = null;
        var changes = new List<RecordChange> { Fence(root) };
        var recipient = await StageApplicantNoticeAsync(parish, item, op, changes, ct);
        changes.Add(RecordChange.Replace(RowKey(id), "registration", item, Versions.Require(request.Version)));
        changes.Add(RecordChange.Replace(PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version));
        // Cancelling never returns money; a refund is a separate reviewed finance request.
        var result = await records.CommitAsync(Scope(parish), op, "registration.cancel_own", id,
            changes, item, ct);
        if (recipient is not null)
            await notifications.DispatchAsync(parish, recipient, "registration:" + op.Id, ct);
        return await ProjectAsync(result, false, ct);
    }

    internal EventRegistrationDto StaffView(EventRegistration item) => ToDto(item, clock.GetUtcNow(), true);

    internal Task<EventRegistrationDto> StaffViewAsync(EventRegistration item, CancellationToken ct) => ProjectAsync(item, true, ct);

    private async Task<EventRegistrationDto> ProjectAsync(EventRegistration item, bool staff, CancellationToken ct)
    {
        var result = ToDto(item, clock.GetUtcNow(), staff);
        result.NotificationOutcome = await outcomes.ReadAsync(item.ParishId, item.NotificationWorkIds, ct);
        return result;
    }

    public async Task<NotificationOutcomeDto> NotificationOutcomeAsync(string parish, string eventId, string id, CancellationToken ct)
    {
        await Authorize(parish, Permissions.RegistrationsManage, ct);
        var row = await Registration(parish, eventId, id, ct);
        return await outcomes.ReadAsync(parish, row.Value.NotificationWorkIds, ct);
    }

    internal static RegistrationPolicyDto ToDto(RegistrationPolicy x) => new()
    {
        Id = x.Id, EventId = x.EventId, FormVersionId = x.FormVersionId, Status = x.Status, Capacity = x.Capacity, TransportCapacity = x.TransportCapacity,
        Fee = x.Fee, Currency = x.Currency, Precision = x.Precision, WaitlistAllowed = x.WaitlistAllowed, MinimumAge = x.MinimumAge, MaximumAge = x.MaximumAge,
        ChildAgeThreshold = x.ChildAgeThreshold, ConsentRequired = x.ConsentRequired, ConsentText = x.ConsentText, DoorAccountIds = [.. x.DoorAccountIds],
        CreatedAt = x.CreatedAt, CreatedBy = x.CreatedBy
    };

    internal static RegistrationFormDto ToDto(RegistrationForm x) => new() { Id = x.Id, EventId = x.EventId, Fields = x.Fields, CreatedAt = x.CreatedAt };

    // Own projections show the member's answers, status, balance and presence, never staff evidence, collectors or the recorder.
    internal static EventRegistrationDto ToDto(EventRegistration x, DateTimeOffset now, bool staff) => new()
    {
        Id = x.Id, EventId = x.EventId, PersonId = x.PersonId, FormVersionId = x.FormVersionId, Origin = x.Origin, Status = RegistrationRules.EffectiveStatus(x, now),
        Transport = x.Transport, Answers = new(x.Answers), ConsentEvidence = staff ? x.ConsentEvidence : null,
        GuardianAuthorityEvidence = staff ? x.GuardianAuthorityEvidence : null, Collectors = staff ? x.Collectors : null,
        IndependentDeparture = x.IndependentDeparture, Fee = x.Fee, Currency = x.Currency, Received = x.Received, Refunded = x.Refunded,
        CreatedAt = x.CreatedAt, CreatedBy = staff ? x.CreatedBy : null, OfferUntil = x.OfferUntil, Presence = x.Presence, LastPresenceAt = x.LastPresenceAt
    };

    internal static RegistrationMovementDto ToDto(RegistrationMovement x) => new()
    {
        Id = x.Id, RegistrationId = x.RegistrationId, Kind = x.Kind, Amount = x.Amount, Currency = x.Currency, EvidenceReference = x.EvidenceReference,
        OccurredAt = x.OccurredAt, RecordedAt = x.RecordedAt, RecordedBy = x.RecordedBy, ApprovedBy = x.ApprovedBy, RefundRequestId = x.RefundRequestId
    };

    internal static RegistrationRefundDto ToDto(RegistrationRefund x) => new()
    {
        Id = x.Id, RegistrationId = x.RegistrationId, Amount = x.Amount, Currency = x.Currency, Status = x.Status, Reason = x.Reason,
        RequestedBy = x.RequestedBy, RequestedAt = x.RequestedAt, ApprovedBy = x.ApprovedBy, RecordedBy = x.RecordedBy
    };

    internal static PresenceChangeDto ToDto(PresenceChange x) => new()
    {
        Id = x.Id, RegistrationId = x.RegistrationId, Action = x.Action, OccurredAt = x.OccurredAt, RecordedAt = x.RecordedAt, RecordedBy = x.RecordedBy,
        CollectorId = x.CollectorId, VerificationEvidence = x.VerificationEvidence, PaperReason = x.PaperReason
    };

    internal static PresentRosterDto ToDto(PresentRoster x) => new()
    {
        EventId = x.EventId, AsOf = x.AsOf, Coverage = x.Coverage,
        Entries = x.Entries.Select(e => new RosterEntryDto
        {
            RegistrationId = e.RegistrationId, PersonId = e.PersonId, DisplayName = e.DisplayName, Presence = e.Presence, LastPresenceAt = e.LastPresenceAt
        }).ToArray()
    };
}
