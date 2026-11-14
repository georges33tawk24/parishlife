// Purpose: registration rules plus the shared versioned-form rules used by event registration and custom workflow forms.
// Main functions: ConsumesSeat, EffectiveStatus, AgeOn, Money, Due, Outstanding, PaymentMethodNames, AcceptedMethods, AcceptsSubmissions, ScheduledBy,
// ValidateFields, ValidateCondition, ValidateAnswers and Applies;
// conditional show/require rules are evaluated server-side against the pinned form version.

namespace ParishLife.Api.Models;

public static class RegistrationRules
{
    public static bool ConsumesSeat(EventRegistration item, DateTimeOffset now) => item.Status == "Confirmed" || item.Status == "Reserved" && item.OfferUntil > now;
    public static string EffectiveStatus(EventRegistration item, DateTimeOffset now) => item.Status == "Reserved" && item.OfferUntil <= now ? "OfferExpired" : item.Status;
    // What the participant owes: the fee copied at submission less any discount the office applied.
    public static decimal Due(EventRegistration item) => item.Fee - item.DiscountAmount;
    public static decimal Outstanding(EventRegistration item) => Due(item) - item.Received + item.Refunded;

    // How a recorded payment was made. These record money handled outside the system; none of them charges anyone.
    public static readonly string[] PaymentMethodNames = ["Cash", "BankTransfer", "MoneyTransfer", "Cheque", "Other"];
    public static string[] AcceptedMethods(RegistrationPolicy policy) => policy.PaymentMethods.Length == 0 ? ["Cash"] : policy.PaymentMethods;

    // Submissions need an open policy, a future event and, when the parish set one, a deadline that has not passed.
    public static bool AcceptsSubmissions(RegistrationPolicy policy, CalendarEvent occurrence, DateTimeOffset now)
        => policy.Status == "Open" && occurrence.StartsAt > now && (policy.ClosesAt is null || policy.ClosesAt > now);

    // The part of the instalment schedule due on or before a date, never more than the participant owes after a discount.
    public static decimal ScheduledBy(RegistrationInstalment[] schedule, decimal due, DateOnly date)
        => schedule.Length == 0 ? due : Math.Min(due, schedule.Where(x => x.DueOn <= date).Sum(x => x.Amount));

    public static int AgeOn(DateOnly birth, DateOnly date) => date.Year - birth.Year - (birth.AddYears(date.Year - birth.Year) > date ? 1 : 0);
    public static void Money(decimal amount, string currency, int precision)
    {
        if (precision is < 0 or > 4 || currency.Length != 3 || currency.Any(c => c is < 'A' or > 'Z') || amount < 0 || amount > 1_000_000_000_000m || decimal.Round(amount, precision) != amount)
            throw new DomainException("invalid_money", "Use a nonnegative exact amount, a three-letter currency and its configured precision.");
    }

    public static void ValidateFields(RegistrationField[] fields)
    {
        if (fields.Length > 40)
            throw new DomainException("form_too_large", "A form supports at most 40 fields.");
        var prior = new Dictionary<string, RegistrationField>(StringComparer.Ordinal);
        foreach (var field in fields)
        {
            if (field?.Key is null || field.Options is null)
                throw new DomainException("invalid_field", "Each field needs a key and an option list (empty unless it is a choice).");
            if (field.Key.Length is < 1 or > 60 || field.Key.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_') || prior.ContainsKey(field.Key))
                throw new DomainException("invalid_field_key", "Use distinct alphanumeric field keys.");
            Guard.Text(field.Label, "Field label", 200);
            if (field.Type is not ("Text" or "Choice" or "Boolean" or "Number" or "Date"))
                throw new DomainException("invalid_field_type", "Unsupported registration field type.");
            if (field.Options.Length > 50 || field.Options.Distinct(StringComparer.Ordinal).Count() != field.Options.Length || field.Options.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 200))
                throw new DomainException("invalid_choices", "Use distinct bounded choice options.");
            if (field.Type == "Choice" && field.Options.Length == 0 || field.Type != "Choice" && field.Options.Length != 0)
                throw new DomainException("invalid_choices", "Only choice fields accept option lists, and they require choices.");
            if (field.VisibleWhenField is not null || field.VisibleWhenValue is not null)
                ValidateCondition(prior, field.VisibleWhenField, field.VisibleWhenValue);
            if (field.RequiredWhenField is not null || field.RequiredWhenValue is not null)
            {
                if (field.Required)
                    throw new DomainException("invalid_condition", "A field is either always required or conditionally required, not both.");
                ValidateCondition(prior, field.RequiredWhenField, field.RequiredWhenValue);
            }
            prior.Add(field.Key, field);
        }
    }

    // A condition names an earlier field and a value that field can actually hold; an impossible value would make the rule unreachable.
    public static void ValidateCondition(IReadOnlyDictionary<string, RegistrationField> earlier, string? key, string? value)
    {
        if (key is null || value is null || !earlier.TryGetValue(key, out var source))
            throw new DomainException("invalid_condition", "A condition must reference an earlier field and an explicit value.");
        if (source.Type == "Choice" && !source.Options.Contains(value, StringComparer.Ordinal) || source.Type == "Boolean" && value is not ("true" or "false"))
            throw new DomainException("invalid_condition", "A condition value must be one the referenced field can hold.");
    }

    public static bool Applies(IReadOnlyDictionary<string, string> answers, string? key, string? value)
        => key is null || answers.TryGetValue(key, out var answer) && answer == value;

    public static void ValidateAnswers(RegistrationField[] fields, IReadOnlyDictionary<string, string> answers)
    {
        if (answers.Count > 40 || answers.Keys.Except(fields.Select(f => f.Key), StringComparer.Ordinal).Any())
            throw new DomainException("unknown_answers", "The answers must match the pinned form version.");
        foreach (var field in fields)
        {
            answers.TryGetValue(field.Key, out var value);
            if (!Applies(answers, field.VisibleWhenField, field.VisibleWhenValue))
            {
                if (!string.IsNullOrEmpty(value))
                    throw new DomainException("hidden_answer", "Omit answers to fields that are not applicable.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(value))
            {
                if (field.Required || field.RequiredWhenField is not null && Applies(answers, field.RequiredWhenField, field.RequiredWhenValue))
                    throw new DomainException("answer_required", "A required form answer is missing.");
                continue;
            }

            if (value.Length > 2000 || field.Type == "Choice" && !field.Options.Contains(value, StringComparer.Ordinal) || field.Type == "Boolean" && value is not ("true" or "false") || field.Type == "Number" && !decimal.TryParse(value, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out _) || field.Type == "Date" && !DateOnly.TryParseExact(value, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out _))
                throw new DomainException("invalid_answer", "An answer does not match the field's type or allowed values.");
        }
    }
}
