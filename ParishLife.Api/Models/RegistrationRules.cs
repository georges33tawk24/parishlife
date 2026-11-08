// Purpose: represents registration rules business state and rules.
// Main functions: ConsumesSeat, EffectiveStatus, AgeOn, Money, ValidateFields, ValidateAnswers.

namespace ParishLife.Api.Models;

public static class RegistrationRules
{
    public static bool ConsumesSeat(EventRegistration item, DateTimeOffset now) => item.Status == "Confirmed" || item.Status == "Reserved" && item.OfferUntil > now;
    public static string EffectiveStatus(EventRegistration item, DateTimeOffset now) => item.Status == "Reserved" && item.OfferUntil <= now ? "OfferExpired" : item.Status;
    public static int AgeOn(DateOnly birth, DateOnly date) => date.Year - birth.Year - (birth.AddYears(date.Year - birth.Year) > date ? 1 : 0);
    public static void Money(decimal amount, string currency, int precision)
    {
        if (precision is < 0 or > 4 || currency.Length != 3 || currency.Any(c => c is < 'A' or > 'Z') || amount < 0 || amount > 1_000_000_000_000m || decimal.Round(amount, precision) != amount)
            throw new DomainException("invalid_money", "Use a nonnegative exact amount, a three-letter currency and its configured precision.");
    }

    public static void ValidateFields(RegistrationField[] fields)
    {
        if (fields.Length > 40)
            throw new DomainException("form_too_large", "A registration form supports at most 40 fields.");
        var prior = new Dictionary<string, RegistrationField>(StringComparer.Ordinal);
        foreach (var field in fields)
        {
            if (field.Key.Length is < 1 or > 60 || field.Key.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_') || !prior.TryAdd(field.Key, field))
                throw new DomainException("invalid_field_key", "Use distinct alphanumeric field keys.");
            Guard.Text(field.Label, "Field label", 200);
            if (field.Type is not ("Text" or "Choice" or "Boolean" or "Number" or "Date"))
                throw new DomainException("invalid_field_type", "Unsupported registration field type.");
            if (field.Options.Length > 50 || field.Options.Distinct(StringComparer.Ordinal).Count() != field.Options.Length || field.Options.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 200))
                throw new DomainException("invalid_choices", "Use distinct bounded choice options.");
            if (field.Type == "Choice" && field.Options.Length == 0 || field.Type != "Choice" && field.Options.Length != 0)
                throw new DomainException("invalid_choices", "Only choice fields accept option lists, and they require choices.");
            if (field.VisibleWhenField is not null && (field.VisibleWhenField == field.Key || !prior.ContainsKey(field.VisibleWhenField) || field.VisibleWhenValue is null))
                throw new DomainException("invalid_condition", "A condition must reference an earlier field and an explicit value.");
        }
    }

    public static void ValidateAnswers(RegistrationField[] fields, IReadOnlyDictionary<string, string> answers)
    {
        if (answers.Count > 40 || answers.Keys.Except(fields.Select(f => f.Key), StringComparer.Ordinal).Any())
            throw new DomainException("unknown_answers", "The answers must match the pinned form version.");
        foreach (var field in fields)
        {
            answers.TryGetValue(field.Key, out var value);
            var visible = field.VisibleWhenField is null || answers.TryGetValue(field.VisibleWhenField, out var dependency) && dependency == field.VisibleWhenValue;
            if (!visible)
            {
                if (!string.IsNullOrEmpty(value))
                    throw new DomainException("hidden_answer", "Omit answers to fields that are not applicable.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(value))
            {
                if (field.Required)
                    throw new DomainException("answer_required", "A required form answer is missing.");
                continue;
            }

            if (value.Length > 2000 || field.Type == "Choice" && !field.Options.Contains(value, StringComparer.Ordinal) || field.Type == "Boolean" && value is not ("true" or "false") || field.Type == "Number" && !decimal.TryParse(value, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out _) || field.Type == "Date" && !DateOnly.TryParseExact(value, "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out _))
                throw new DomainException("invalid_answer", "An answer does not match the field's type or allowed values.");
        }
    }
}
