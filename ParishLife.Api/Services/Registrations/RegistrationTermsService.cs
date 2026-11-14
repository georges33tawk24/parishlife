// Purpose: office changes to event registration after the policy exists: editing its terms, applying a named discount to one registration,
// registering several members of one household together, and issuing or revoking a pickup code.
// Main functions: ReviseTermsAsync, ApplyDiscountAsync, RegisterHouseholdAsync and PickupCodeAsync. All require registrations.manage with current MFA,
// fence the parish root and the event policy, and use operation ids for idempotency. A pickup code is returned once in the issuing response;
// only its salted hash is stored and neither the operation receipt nor the audit carries it.

using ParishLife.Api.DTOs.Registrations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Registrations;

public sealed class RegistrationTermsService(IRecordTransactions records, ICurrentActor actor, IAccountDirectory accounts, RegistrationService registrations, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => RegistrationService.Scope(parish);

    public async Task<RegistrationPolicy> ReviseTermsAsync(string parish, string eventId, ReviseRegistrationTermsDto request, CancellationToken ct)
    {
        var root = await registrations.Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = registrations.Op(request.OperationId, request, "registration-terms:" + eventId);
        if (await records.ReplayAsync<RegistrationPolicy>(Scope(parish), op, ct) is { } replay)
            return replay;
        var row = await registrations.Get<RegistrationPolicy>(parish, RegistrationService.PolicyKey(eventId), ct);
        var occurrence = await registrations.Event(parish, eventId, ct);
        if (request.DoorAccountIds is null)
            throw new DomainException("invalid_registration_policy", "Door operators are required (an empty list is allowed).");
        RegistrationTermRules.Validate(request.Capacity, request.TransportCapacity, request.MinimumAge, request.MaximumAge, request.ChildAgeThreshold, request.DoorAccountIds.Length);
        var currency = Guard.Text(request.Currency, "Currency", 3);
        RegistrationRules.Money(request.Fee, currency, request.Precision);
        var participants = (await registrations.Participants(parish, eventId, ct)).Select(x => x.Value).ToArray();
        // Registrations keep the fee, currency and precision copied when they were submitted; changing the currency under them would make balances meaningless.
        if ((currency != row.Value.Currency || request.Precision != row.Value.Precision) && participants.Length > 0)
            throw new DomainException("registration_currency_locked", "The currency and precision cannot change once anyone is registered.", FailureKind.Conflict);
        var seated = participants.Where(x => RegistrationRules.ConsumesSeat(x, clock.GetUtcNow())).ToArray();
        if (request.Capacity < seated.Length || request.TransportCapacity < seated.Count(x => x.Transport))
            throw new DomainException("capacity_below_current", "Capacity cannot be set below the participants who already hold a seat or transport place.", FailureKind.Conflict);
        if (request.ConsentRequired)
            Guard.Text(request.ConsentText, "Consent wording", 10000);
        var doors = request.DoorAccountIds.Select(Guard.Id).Distinct().ToArray();
        foreach (var account in doors)
            if (!await accounts.IsActiveVerifiedAsync(account, ct))
                throw new DomainException("door_account_unavailable", "Door operators must be active verified accounts.");
        var result = RegistrationCopy.Of(row.Value);
        result.Capacity = request.Capacity;
        result.TransportCapacity = request.TransportCapacity;
        result.Fee = request.Fee;
        result.Currency = currency;
        result.Precision = request.Precision;
        result.WaitlistAllowed = request.WaitlistAllowed;
        result.MinimumAge = request.MinimumAge;
        result.MaximumAge = request.MaximumAge;
        result.ChildAgeThreshold = request.ChildAgeThreshold;
        result.ConsentRequired = request.ConsentRequired;
        result.ConsentText = request.ConsentText ?? string.Empty;
        result.DoorAccountIds = doors;
        result.ClosesAt = RegistrationTermRules.Deadline(request.ClosesAt, occurrence.Value);
        result.Discounts = RegistrationTermRules.Discounts(request.Discounts, request.Fee, currency, request.Precision);
        result.Instalments = RegistrationTermRules.Instalments(request.Instalments, request.Fee, currency, request.Precision, RegistrationTermRules.EventDate(occurrence.Value));
        result.PaymentMethods = RegistrationTermRules.Methods(request.PaymentMethods);
        result.MusterPoint = RegistrationTermRules.OptionalText(request.MusterPoint, "Muster point", 300);
        result.MusterPointAr = RegistrationTermRules.OptionalText(request.MusterPointAr, "Arabic muster point", 300);
        result.UpdatedAt = op.At;
        result.UpdatedBy = actor.AccountId;
        var reason = Guard.Text(request.Reason, "Reason", 2000);
        return await records.CommitAsync(Scope(parish), op, "registration.revise_terms", eventId,
            [RegistrationService.Fence(root), RecordChange.Replace(RegistrationService.PolicyKey(eventId), "registrationPolicy", result, Versions.Require(request.Version)),
             RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version)], result, ct, reason);
    }

    public async Task<EventRegistration> ApplyDiscountAsync(string parish, string eventId, string id, ApplyRegistrationDiscountDto request, CancellationToken ct)
    {
        var root = await registrations.Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = registrations.Op(request.OperationId, request, "registration-discount:" + id);
        if (await records.ReplayAsync<EventRegistration>(Scope(parish), op, ct) is not null)
            return (await registrations.Registration(parish, eventId, id, ct)).Value;
        var row = await registrations.Registration(parish, eventId, id, ct);
        var policy = await registrations.Get<RegistrationPolicy>(parish, RegistrationService.PolicyKey(eventId), ct);
        if (row.Value.Status == "Cancelled")
            throw RegistrationService.Invalid("Discounts apply to active registrations only.");
        var reason = Guard.Text(request.Reason, "Reason", 2000);
        var item = RegistrationCopy.Of(row.Value);
        if (request.DiscountKey is null)
        {
            if (item.DiscountKey is null)
                throw RegistrationService.Invalid("No discount is applied to this registration.");
            item.DiscountKey = item.DiscountName = item.DiscountNameAr = null;
            item.DiscountAmount = 0;
        }
        else
        {
            var discount = policy.Value.Discounts.FirstOrDefault(x => x.Key == request.DiscountKey)
                ?? throw new DomainException("discount_unavailable", "This event does not offer that discount.", FailureKind.Conflict);
            if (item.Currency != policy.Value.Currency || discount.Amount > item.Fee)
                throw RegistrationService.Invalid("The discount does not fit the fee this registration was submitted with.");
            item.DiscountKey = discount.Key;
            item.DiscountName = discount.Name;
            item.DiscountNameAr = discount.NameAr;
            item.DiscountAmount = discount.Amount;
        }

        // A discount never creates a negative balance; return money first through the reviewed refund flow.
        if (RegistrationRules.Due(item) < item.Received - item.Refunded)
            throw new DomainException("discount_below_received", "The discounted amount would be less than what was already received; record a refund first.", FailureKind.Conflict);
        return await records.CommitAsync(Scope(parish), op, request.DiscountKey is null ? "registration.discount_remove" : "registration.discount_apply", id,
            [RegistrationService.Fence(root), RecordChange.Replace(RegistrationService.RowKey(id), "registration", item, Versions.Require(request.Version)),
             RecordChange.Replace(RegistrationService.PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version)], item, ct, reason);
    }

    public async Task<IReadOnlyList<EventRegistration>> RegisterHouseholdAsync(string parish, string eventId, RegisterHouseholdDto request, CancellationToken ct)
    {
        var root = await registrations.Authorize(parish, Permissions.RegistrationsManage, ct);
        var op = registrations.Op(request.OperationId, request, "registration-household:" + eventId);
        if (await records.ReplayAsync<HouseholdRegistrationBatch>(Scope(parish), op, ct) is { } replay)
        {
            var prior = new List<EventRegistration>();
            foreach (var registrationId in replay.RegistrationIds)
                prior.Add((await registrations.Registration(parish, eventId, registrationId, ct)).Value);
            return prior;
        }

        var policy = await registrations.Get<RegistrationPolicy>(parish, RegistrationService.PolicyKey(eventId), ct);
        var occurrence = await registrations.Event(parish, eventId, ct);
        RegistrationService.RequireEligibleEvent(occurrence.Value);
        registrations.RequireAcceptingSubmissions(policy.Value, occurrence.Value);
        var householdId = Guard.Id(request.HouseholdId);
        var household = await registrations.Get<Household>(parish, "household:" + householdId, ct);
        if (household.Value.Status != "Active")
            throw RegistrationService.Invalid("Only an active household can be registered together.");
        var form = await registrations.ViewedFormAsync(parish, policy.Value, request.FormVersionId, ct);
        if (request.Members is null || request.Members.Length is < 1 or > 12 || request.Members.Any(x => x is null)
            || request.Members.Select(x => x.PersonId).Distinct().Count() != request.Members.Length)
            throw new DomainException("invalid_household_registration", "Register one to twelve distinct household members.");

        var changes = new List<RecordChange> { RegistrationService.Fence(root), RecordChange.Replace("household:" + householdId, "household", household.Value, household.Version) };
        var created = new List<EventRegistration>();
        foreach (var member in request.Members)
        {
            var personId = Guard.Id(member.PersonId);
            // Membership is the household's current record; nothing is inferred from relationships or a shared address.
            var membership = await records.ReadAsync<HouseholdMember>(Scope(parish), "householdMember:" + personId, ct);
            if (membership is null || membership.Value.HouseholdId != householdId)
                throw new DomainException("not_household_member", "Every participant must currently belong to the household.", FailureKind.Conflict);
            var person = await registrations.Get<Person>(parish, "person:" + personId, ct);
            if (person.Value.Archived)
                throw RegistrationService.Invalid("Restore or review the archived person before registering.");
            if (member.Answers is null || member.Collectors is null)
                throw new DomainException("participant_input_required", "Answers and collector lists are required.");
            RegistrationRules.ValidateAnswers(form.Fields, member.Answers);
            RegistrationService.ValidateCollectors(member.Collectors);
            var id = RegistrationService.RegistrationId(eventId, personId);
            if (await records.ReadAsync<EventRegistration>(Scope(parish), RegistrationService.RowKey(id), ct) is not null)
                throw RegistrationService.Invalid("A household member already has a registration for this event.");
            var item = new EventRegistration
            {
                Id = id, ParishId = parish, EventId = eventId, PersonId = personId, Origin = "Office", FormVersionId = form.Id, Status = "Submitted",
                Transport = member.Transport, Answers = member.Answers, ConsentEvidence = RegistrationService.Optional(member.ConsentEvidence),
                GuardianAuthorityEvidence = RegistrationService.Optional(member.GuardianAuthorityEvidence), Collectors = member.Collectors,
                IndependentDeparture = member.IndependentDeparture, Fee = policy.Value.Fee, Currency = policy.Value.Currency, Precision = policy.Value.Precision,
                CreatedAt = op.At, CreatedBy = actor.AccountId, NotificationWorkIds = [], HouseholdId = householdId
            };
            changes.Add(RecordChange.Replace("householdMember:" + personId, "householdMember", membership.Value, membership.Version));
            changes.Add(RecordChange.Replace("person:" + personId, "person", person.Value, person.Version));
            changes.Add(RecordChange.Create(RegistrationService.RowKey(id), "registration", item));
            created.Add(item);
        }

        changes.Add(RecordChange.Replace(RegistrationService.PolicyKey(eventId), "registrationPolicy", policy.Value, policy.Version));
        changes.Add(RecordChange.Replace("event:" + eventId, "event", occurrence.Value, occurrence.Version));
        var batch = new HouseholdRegistrationBatch { Id = op.Id, EventId = eventId, HouseholdId = householdId, RegistrationIds = created.Select(x => x.Id).ToArray() };
        await records.CommitAsync(Scope(parish), op, "registration.submit_household", householdId, changes, batch, ct);
        return created;
    }

    public async Task<PickupCodeResultDto> PickupCodeAsync(string parish, string eventId, string id, PickupCodeActionDto request, CancellationToken ct)
    {
        var root = await registrations.Authorize(parish, Permissions.RegistrationsManage, ct);
        // The request carries no secret; the code is generated here after the fingerprint exists.
        var op = registrations.Op(request.OperationId, request, "registration-pickup-code:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } replay)
            return new PickupCodeResultDto
            {
                RegistrationId = id, Action = request.Action,
                Note = "This request was already applied. A pickup code is shown only once; issue a new code if it was not kept."
            };
        var row = await registrations.Registration(parish, eventId, id, ct);
        if (row.Value.Status == "Cancelled")
            throw RegistrationService.Invalid("Pickup codes apply to active registrations only.");
        var reason = Guard.Text(request.Reason, "Reason", 2000);
        var item = RegistrationCopy.Of(row.Value);
        string? code = null;
        if (request.Action == "issue")
        {
            if (item.IndependentDeparture)
                throw RegistrationService.Invalid("This participant may leave alone, so no collection code applies.");
            var issued = PickupCodes.Issue();
            code = issued.Code;
            item.PickupCodeSalt = issued.Salt;
            item.PickupCodeHash = issued.Hash;
            item.PickupCodeIssuedAt = op.At;
        }
        else if (request.Action == "revoke")
        {
            if (item.PickupCodeHash is null)
                throw RegistrationService.Invalid("No pickup code is issued for this registration.");
            item.PickupCodeSalt = item.PickupCodeHash = null;
            item.PickupCodeIssuedAt = null;
        }
        else
            throw new DomainException("invalid_pickup_code_action", "Use issue or revoke.");

        var status = code is null ? "Revoked" : "Issued";
        await records.CommitAsync(Scope(parish), op, "registration.pickup_code_" + request.Action, id,
            [RegistrationService.Fence(root), RecordChange.Replace(RegistrationService.RowKey(id), "registration", item, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = status }, ct, reason);
        return new PickupCodeResultDto
        {
            RegistrationId = id, Action = request.Action, Code = code, IssuedAt = item.PickupCodeIssuedAt,
            Note = code is null
                ? "The pickup code is revoked; checkout needs only the authorized collector and identity check."
                : "Give this code to the guardian now. It is not stored and cannot be shown again; the door must enter it at checkout."
        };
    }
}
