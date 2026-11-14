// Purpose: validates the editable terms of an event registration policy, shared by first configuration and later edits:
// capacity, ages, consent, door operators, deadline, discounts, instalment schedule, payment methods and muster point.
// Main functions: Validate, Discounts, Instalments, Methods and OptionalText. Values are supplied by the parish; nothing here invents a default.

using ParishLife.Api.Models;

namespace ParishLife.Api.Services.Registrations;

internal static class RegistrationTermRules
{
    public static void Validate(int capacity, int transportCapacity, int? minimumAge, int? maximumAge, int childAgeThreshold, int doorCount)
    {
        if (capacity is < 1 or > 4000 || transportCapacity < 0 || transportCapacity > capacity || minimumAge is < 0 or > 120 || maximumAge is < 0 or > 120
            || maximumAge < minimumAge || childAgeThreshold is < 1 or > 25 || doorCount > 40)
            throw new DomainException("invalid_registration_policy", "Use bounded capacity, explicit age/guardian policy and bounded form/operator lists.");
    }

    public static DateTimeOffset? Deadline(DateTimeOffset? closesAt, CalendarEvent occurrence)
    {
        if (closesAt is null)
            return null;
        if (Guard.Utc(closesAt.Value) >= occurrence.StartsAt)
            throw new DomainException("invalid_registration_deadline", "The registration deadline must be before the event starts.");
        return closesAt;
    }

    public static RegistrationDiscount[] Discounts(RegistrationDiscount[]? discounts, decimal fee, string currency, int precision)
    {
        discounts ??= [];
        if (discounts.Length > 20 || discounts.Any(x => x is null) || discounts.Select(x => x.Key).Distinct(StringComparer.Ordinal).Count() != discounts.Length)
            throw new DomainException("invalid_discounts", "Use up to twenty discounts with distinct keys.");
        return discounts.Select(x =>
        {
            if (x.Key is not { Length: >= 1 and <= 60 } || x.Key.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_'))
                throw new DomainException("invalid_discounts", "Use alphanumeric discount keys.");
            RegistrationRules.Money(x.Amount, currency, precision);
            if (x.Amount <= 0 || x.Amount > fee)
                throw new DomainException("invalid_discounts", "A discount must be a positive amount no greater than the fee.");
            return new RegistrationDiscount { Key = x.Key, Name = Guard.Text(x.Name, "Discount name", 200), NameAr = OptionalText(x.NameAr, "Arabic discount name", 200), Amount = x.Amount };
        }).ToArray();
    }

    public static RegistrationInstalment[] Instalments(RegistrationInstalment[]? schedule, decimal fee, string currency, int precision, DateOnly eventDate)
    {
        schedule ??= [];
        if (schedule.Length == 0)
            return [];
        if (schedule.Length > 12 || schedule.Any(x => x is null))
            throw new DomainException("invalid_instalments", "Use at most twelve instalments.");
        for (var i = 0; i < schedule.Length; i++)
        {
            RegistrationRules.Money(schedule[i].Amount, currency, precision);
            if (schedule[i].Amount <= 0 || schedule[i].DueOn > eventDate || i > 0 && schedule[i].DueOn <= schedule[i - 1].DueOn)
                throw new DomainException("invalid_instalments", "Instalments need positive amounts and increasing dates no later than the event.");
        }

        if (schedule.Sum(x => x.Amount) != fee)
            throw new DomainException("invalid_instalments", "The instalments must add up exactly to the fee.");
        return schedule.Select(x => new RegistrationInstalment { DueOn = x.DueOn, Amount = x.Amount }).ToArray();
    }

    public static string[] Methods(string[]? methods)
    {
        methods ??= [];
        if (methods.Length > RegistrationRules.PaymentMethodNames.Length || methods.Distinct(StringComparer.Ordinal).Count() != methods.Length
            || methods.Any(x => !RegistrationRules.PaymentMethodNames.Contains(x, StringComparer.Ordinal)))
            throw new DomainException("invalid_payment_methods", "Use distinct methods from: " + string.Join(", ", RegistrationRules.PaymentMethodNames) + ".");
        return methods;
    }

    public static string? OptionalText(string? value, string name, int maximum) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, name, maximum);

    public static DateOnly EventDate(CalendarEvent occurrence)
        => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(occurrence.StartsAt, TimeZoneInfo.FindSystemTimeZoneById(occurrence.TimeZone)).DateTime);
}
