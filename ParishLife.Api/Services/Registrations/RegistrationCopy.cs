// Purpose: copies event registrations and registration policies field by field, so every transition keeps the fields it does not change
// (household, discount snapshot, pickup-code hash, deadline, discounts, instalments, payment methods, muster point).
// Main functions: Of (full copy) and Carry (adds the later-added fields of a prior record to a copy built with an object initializer).

using ParishLife.Api.Models;

namespace ParishLife.Api.Services.Registrations;

internal static class RegistrationCopy
{
    public static EventRegistration Of(EventRegistration x) => Carry(new EventRegistration
    {
        Id = x.Id, ParishId = x.ParishId, EventId = x.EventId, PersonId = x.PersonId, Origin = x.Origin, FormVersionId = x.FormVersionId, Status = x.Status,
        Transport = x.Transport, Answers = x.Answers, ConsentEvidence = x.ConsentEvidence, GuardianAuthorityEvidence = x.GuardianAuthorityEvidence,
        Collectors = x.Collectors, IndependentDeparture = x.IndependentDeparture, Fee = x.Fee, Currency = x.Currency, Precision = x.Precision,
        Received = x.Received, Refunded = x.Refunded, CreatedAt = x.CreatedAt, CreatedBy = x.CreatedBy, OfferUntil = x.OfferUntil, Presence = x.Presence,
        LastPresenceAt = x.LastPresenceAt, NotificationWorkIds = x.NotificationWorkIds
    }, x);

    public static EventRegistration Carry(EventRegistration next, EventRegistration prior)
    {
        next.HouseholdId = prior.HouseholdId;
        next.DiscountKey = prior.DiscountKey;
        next.DiscountName = prior.DiscountName;
        next.DiscountNameAr = prior.DiscountNameAr;
        next.DiscountAmount = prior.DiscountAmount;
        next.PickupCodeHash = prior.PickupCodeHash;
        next.PickupCodeSalt = prior.PickupCodeSalt;
        next.PickupCodeIssuedAt = prior.PickupCodeIssuedAt;
        return next;
    }

    public static RegistrationPolicy Of(RegistrationPolicy x) => Carry(new RegistrationPolicy
    {
        Id = x.Id, ParishId = x.ParishId, EventId = x.EventId, FormVersionId = x.FormVersionId, Status = x.Status, Capacity = x.Capacity,
        TransportCapacity = x.TransportCapacity, Fee = x.Fee, Currency = x.Currency, Precision = x.Precision, WaitlistAllowed = x.WaitlistAllowed,
        MinimumAge = x.MinimumAge, MaximumAge = x.MaximumAge, ChildAgeThreshold = x.ChildAgeThreshold, ConsentRequired = x.ConsentRequired,
        ConsentText = x.ConsentText, DoorAccountIds = x.DoorAccountIds, CreatedAt = x.CreatedAt, CreatedBy = x.CreatedBy
    }, x);

    public static RegistrationPolicy Carry(RegistrationPolicy next, RegistrationPolicy prior)
    {
        next.ClosesAt = prior.ClosesAt;
        next.Discounts = prior.Discounts;
        next.Instalments = prior.Instalments;
        next.PaymentMethods = prior.PaymentMethods;
        next.MusterPoint = prior.MusterPoint;
        next.MusterPointAr = prior.MusterPointAr;
        next.UpdatedAt = prior.UpdatedAt;
        next.UpdatedBy = prior.UpdatedBy;
        return next;
    }
}
