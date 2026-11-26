// Purpose: the checks a person's core record must pass wherever it is written (office create and edit, CSV import, and the
// DTO validation attributes), so the screens and the API apply the same rules (owner, 27 November 2026).
// Main functions: NameProblem and Name (letters only: Latin letters for the English name, Arabic letters for the Arabic one; spaces,
// hyphens, apostrophes and full stops between them), BirthDateProblem and RequireBirthDate (not in the future, not more than
// MaxAgeYears ago), Phones/Phone (Lebanese numbers by prefix and length, foreign numbers by international length), LanguageCodes
// and Skill (free text without digits).

using System.Globalization;
using System.Text;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;

namespace ParishLife.Api.Services.People;

public static class PersonRules
{
    public const int MaxAgeYears = 110;
    public const int MaxPhones = 5;
    private static readonly string[] LebaneseMobilePrefixes = ["70", "71", "76", "78", "79", "81"];

    private static bool Latin(char c) => c is >= 'A' and <= 'Z' or >= 'a' and <= 'z' || c is >= 'À' and <= 'ɏ' && c != '×' && c != '÷'
        || c is >= 'Ḁ' and <= 'ỿ';

    // Arabic letters and their marks, without the Arabic-Indic digits (U+0660–0669, U+06F0–06F9) or Arabic punctuation.
    private static bool Arabic(char c) => c is >= 'ؠ' and <= 'ٟ' or >= 'ٮ' and <= 'ۓ' or >= 'ە' and <= 'ۜ'
        or >= 'ۺ' and <= 'ۿ' or >= 'ݐ' and <= 'ݿ' or >= 'ࢠ' and <= 'ࣿ' or >= 'ﭐ' and <= 'ﷻ' or >= 'ﹰ' and <= 'ﻼ';

    /// <summary>Why a typed name cannot be stored, or null when it can. Digits and symbols are refused in both scripts.</summary>
    public static string? NameProblem(string? value, string label, bool arabic)
    {
        var text = value?.Trim() ?? "";
        if (text.Length == 0)
            return null;
        if (text.Length > 100)
            return $"{label} must not exceed 100 characters.";
        var letters = 0;
        foreach (var c in text)
        {
            if (arabic ? Arabic(c) : Latin(c) || CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                letters++;
            else if (c is not (' ' or '-' or '\'' or '’' or '.'))
                return char.IsDigit(c)
                    ? $"{label} may contain letters only, not digits."
                    : arabic ? $"{label} may contain Arabic letters only." : $"{label} may contain English (Latin) letters only.";
        }
        return letters == 0 ? $"{label} must contain letters." : null;
    }

    /// <summary>A required name, trimmed with single spaces, or a validation failure.</summary>
    public static string Name(string? value, string label, bool arabic)
    {
        var text = Guard.Text(value, label, 100);
        return NameProblem(text, label, arabic) is { } problem ? throw new DomainException("invalid_name", problem) : Collapse(text);
    }

    /// <summary>An optional name: null when blank, otherwise checked like a required one.</summary>
    public static string? OptionalName(string? value, string label, bool arabic) => string.IsNullOrWhiteSpace(value) ? null : Name(value, label, arabic);

    private static string Collapse(string text) => string.Join(' ', text.Split(' ', StringSplitOptions.RemoveEmptyEntries));

    public static string? BirthDateProblem(DateOnly? birthDate, DateOnly today)
    {
        if (birthDate is not { } date)
            return null;
        if (date > today)
            return "Birth date cannot be in the future.";
        return date < today.AddYears(-MaxAgeYears) ? $"Birth date cannot be more than {MaxAgeYears} years ago." : null;
    }

    public static void RequireBirthDate(DateOnly? birthDate, DateOnly today)
    {
        if (BirthDateProblem(birthDate, today) is { } problem)
            throw new DomainException("invalid_birth_date", problem);
    }

    /// <summary>
    /// The person's numbers in international form. A number without "+" or "00" is Lebanese; its trunk 0 is dropped. Lebanese
    /// mobiles are 03 plus 6 digits, or 70, 71, 76, 78, 79 or 81 plus 6 digits; landlines are 01 and 04 to 09 plus 6 digits.
    /// A foreign number needs its country code and 8 to 15 digits in all. Repeated numbers are kept once.
    /// </summary>
    public static PersonPhone[] Phones(IEnumerable<PersonPhoneDto>? phones)
    {
        var list = (phones ?? []).ToArray();
        if (list.Length > MaxPhones)
            throw new DomainException("invalid_phone", $"A person can have up to {MaxPhones} phone numbers.");
        var result = new List<PersonPhone>();
        foreach (var item in list)
        {
            var phone = Phone(item?.Number, item?.Kind);
            if (!result.Any(p => p.Number == phone.Number))
                result.Add(phone);
        }
        return [.. result];
    }

    public static PersonPhone Phone(string? number, string? kind)
    {
        var text = number?.Trim() ?? "";
        if (text.Length is 0 or > 30 || text.Any(c => !char.IsAsciiDigit(c) && c is not (' ' or '-' or '.' or '(' or ')' or '+')) || text.LastIndexOf('+') > 0)
            throw new DomainException("invalid_phone", "Enter a phone number with digits only, optionally starting with + and the country code.");
        var digits = new StringBuilder();
        foreach (var c in text)
            if (char.IsAsciiDigit(c))
                digits.Append(c);
        var all = digits.ToString();
        var international = text.StartsWith('+') || all.StartsWith("00", StringComparison.Ordinal);
        if (all.StartsWith("00", StringComparison.Ordinal))
            all = all[2..];
        if (!international || all.StartsWith("961", StringComparison.Ordinal))
        {
            var national = international ? all[3..] : all;
            if (national.StartsWith('0'))
                national = national[1..];
            var lebaneseKind = LebaneseKind(national)
                ?? throw new DomainException("invalid_phone",
                    "Enter a Lebanese number: 03 and landlines (01, 04 to 09) have 7 digits after the leading 0; 70, 71, 76, 78, 79 and 81 have 8 digits.");
            return new PersonPhone { Number = "+961" + national, Kind = lebaneseKind };
        }
        if (all.Length is < 8 or > 15 || all[0] == '0')
            throw new DomainException("invalid_phone", "Enter a foreign number with its country code (8 to 15 digits in all).");
        if (kind is not (null or "" or "Mobile" or "Landline"))
            throw new DomainException("invalid_phone", "A phone number is a Mobile or a Landline.");
        return new PersonPhone { Number = "+" + all, Kind = string.IsNullOrEmpty(kind) ? null : kind };
    }

    /// <summary>Mobile or Landline for a Lebanese national number without its trunk 0, or null when it is not a valid one.</summary>
    public static string? LebaneseKind(string national)
    {
        if (national.Length == 0 || national.Any(c => !char.IsAsciiDigit(c)))
            return null;
        if (national.Length == 7 && national[0] == '3')
            return "Mobile";
        if (national.Length == 8 && LebaneseMobilePrefixes.Contains(national[..2]))
            return "Mobile";
        return national.Length == 7 && national[0] is '1' or '4' or '5' or '6' or '7' or '8' or '9' ? "Landline" : null;
    }

    /// <summary>Distinct lower-case ISO 639 language codes (two or three letters).</summary>
    public static string[] LanguageCodes(IEnumerable<string>? codes)
    {
        var list = (codes ?? []).Select(c => c?.Trim().ToLowerInvariant() ?? "").Distinct(StringComparer.Ordinal).ToArray();
        if (list.Length > 10 || list.Any(c => c.Length is < 2 or > 3 || c.Any(ch => ch is < 'a' or > 'z')))
            throw new DomainException("invalid_input", "Languages are up to ten two- or three-letter language codes.");
        return list;
    }

    /// <summary>One skill as typed: free text up to 80 characters, without digits.</summary>
    public static string Skill(string? value)
    {
        var text = Guard.Text(value, "Skill", 80);
        return text.Any(char.IsDigit) ? throw new DomainException("invalid_input", "A skill may not contain digits.") : Collapse(text);
    }
}
