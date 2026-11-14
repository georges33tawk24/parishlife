// Purpose: maintains the eligible holder's personal display, appearance and self-described details in one conditional account-partition transaction.
// Main functions: GetAsync reads coherent safe state; UpdateAsync and ResetAppearanceAsync commit/replay; PreviewAsync validates readable colors without saving.
// Eligibility is rechecked before every read/retry; official Person facts, login aliases and security credentials are never editable here.
// The personal details (names, town, address, occupation, about) are the holder's own text, visible only to them, never copied into a Person.

using System.Globalization;
using ParishLife.Api.DTOs.Accounts.Profile;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class AccountProfileService(IRecordTransactions records, MfaAccountAccess access, ParishUserManager users,
    ICurrentActor actor, TimeProvider clock)
{
    private const string ProfileKey = "accountProfile";
    private static readonly IReadOnlyDictionary<string, string> Presets = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["forest"] = "#233B32",
        ["navy"] = "#1F3A5F",
        ["marian"] = "#1C4F8A",
        ["burgundy"] = "#6E1F31",
        ["purple"] = "#4A2D6E",
        ["teal"] = "#12514C",
        ["cedar"] = "#5B3F2B",
        ["slate"] = "#2E3A46"
    };

    public async Task<Versioned<AccountProfileDto>> GetAsync(CancellationToken ct)
    {
        // Reading the identity fence on both sides prevents a mixed old-name/new-preference projection during a concurrent save.
        for (var attempt = 0; attempt < 3; attempt++)
        {
            var user = await EligibleAsync(ct);
            var profile = await ReadProfileAsync(user.Id, ct);
            var current = await EligibleAsync(ct);
            if (user.PersistenceVersion == current.PersistenceVersion)
                return Project(current, profile?.Value);
        }
        throw new DomainException("write_conflict", "The account changed while being read. Reload the current profile.", FailureKind.Conflict);
    }

    public async Task<AccountAppearancePreviewDto> PreviewAsync(AccountAppearanceDto request, CancellationToken ct)
    {
        _ = await EligibleAsync(ct);
        var appearance = Normalize(request);
        var primary = appearance.PrimaryColor!;
        var surface = appearance.Mode == "dark" ? "#11161E" : "#FFFFFF";
        var foreground = appearance.Mode == "dark" ? "#F3F6FC" : "#1F2937";
        var onPrimary = Contrast(primary, "#FFFFFF") >= Contrast(primary, "#000000") ? "#FFFFFF" : "#000000";
        var link = ReadableLink(primary, surface, appearance.Mode == "dark");
        return new AccountAppearancePreviewDto
        {
            Appearance = appearance,
            PrimaryForeground = onPrimary,
            SurfaceColor = surface,
            SurfaceForeground = foreground,
            FocusColor = foreground,
            PrimaryOutlineColor = foreground,
            LinkColor = link,
            PrimaryTextContrast = Contrast(primary, onPrimary),
            LinkContrast = Contrast(link, surface),
            OverridesSemanticStatusColors = false,
            Saved = false
        };
    }

    public async Task<AccountProfileResultDto> UpdateAsync(UpdateAccountProfileDto request, CancellationToken ct)
    {
        var user = await EligibleAsync(ct);
        var displayName = Guard.Text(request.DisplayName, "Personal display name", 200);
        if (displayName.Any(char.IsControl))
            throw new DomainException("invalid_profile", "Personal display name must be one line of plain display text.");
        var language = request.PreferredLanguage;
        if (language is not (null or "en" or "fr" or "ar"))
            throw new DomainException("invalid_profile", "Choose English, French or Arabic, or leave the preference unset.");
        var appearance = Normalize(request.Appearance);
        var details = Details(request);
        var version = Versions.Require(request.Version);
        var operation = Operation.Create(request.OperationId, user.Id,
            new { Kind = "profile.update", Version = version, DisplayName = displayName, PreferredLanguage = language, Appearance = appearance, Details = details },
            clock, "account-profile:v1");
        var scope = MfaRecoveryService.Scope(user.Id);
        if (await records.ReplayAsync<AccountProfileCommit>(scope, operation, ct) is { } prior)
            return await ResultAsync(operation, prior, true, displayName, language, appearance, details, ct);
        RequireCurrentVersion(user, version);
        var previous = await ReadProfileAsync(user.Id, ct);
        var profile = CreateProfile(user.Id, language, appearance, details, operation.At);
        user.DisplayName = displayName;
        var changes = Changes(user, previous, profile);
        var candidate = new AccountProfileCommit { CommitId = Guid.NewGuid().ToString("N"), AppliedAt = operation.At };
        var outcome = await records.CommitAsync(scope, operation, "account.profile_updated", user.Id, changes, candidate, ct);
        return await ResultAsync(operation, outcome, outcome.CommitId != candidate.CommitId, displayName, language, appearance, details, ct);
    }

    public async Task<AccountProfileResultDto> ResetAppearanceAsync(ResetAccountAppearanceDto request, CancellationToken ct)
    {
        var user = await EligibleAsync(ct);
        var version = Versions.Require(request.Version);
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "profile.appearance.reset", Version = version }, clock, "account-profile:v1");
        var scope = MfaRecoveryService.Scope(user.Id);
        var appearance = Normalize(new AccountAppearanceDto());
        if (await records.ReplayAsync<AccountProfileCommit>(scope, operation, ct) is { } prior)
            return await ResultAsync(operation, prior, true, null, null, appearance, null, ct);
        RequireCurrentVersion(user, version);
        var previous = await ReadProfileAsync(user.Id, ct);
        // Resetting the colours keeps the language and the personal details exactly as stored.
        var profile = CreateProfile(user.Id, previous?.Value.PreferredLanguage, appearance, previous?.Value, operation.At);
        var candidate = new AccountProfileCommit { CommitId = Guid.NewGuid().ToString("N"), AppliedAt = operation.At };
        var outcome = await records.CommitAsync(scope, operation, "account.appearance_reset", user.Id, Changes(user, previous, profile), candidate, ct);
        return await ResultAsync(operation, outcome, outcome.CommitId != candidate.CommitId, null, null, appearance, null, ct);
    }

    private async Task<ParishUser> EligibleAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || access.RecoverySession)
            throw new DomainException("personal_profile_capacity_required", "Use a normal personal sign-in for account profile preferences.", FailureKind.Forbidden);
        var user = await access.CurrentAsync(ct);
        if (await users.IsLockedOutAsync(user))
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        return user.TwoFactorEnabled || user.PlatformOperator ? await access.RequireMfaAsync(ct) : user;
    }

    private static void RequireCurrentVersion(ParishUser user, string version)
    {
        if (!string.Equals(user.PersistenceVersion, version, StringComparison.Ordinal))
            throw new DomainException("write_conflict", "The account or profile changed. Reload before saving a new operation.", FailureKind.Conflict);
    }

    private async Task<Versioned<AccountProfile>?> ReadProfileAsync(string account, CancellationToken ct)
    {
        var profile = await records.ReadAsync<AccountProfile>(MfaRecoveryService.Scope(account), ProfileKey, ct);
        if (profile is not null && (profile.Value.AccountId != account || profile.Value.PreferredLanguage is not (null or "en" or "fr" or "ar")))
            throw new DomainException("profile_unavailable", "The account profile is unavailable.", FailureKind.Unavailable);
        return profile;
    }

    private static AccountProfile CreateProfile(string owner, string? language, AccountAppearanceDto appearance, AccountProfile? details, DateTimeOffset at) => new()
    {
        AccountId = owner,
        PreferredLanguage = language,
        Mode = appearance.Mode,
        Scheme = appearance.Scheme,
        PrimaryColor = appearance.PrimaryColor!,
        GivenName = details?.GivenName,
        GivenNameAr = details?.GivenNameAr,
        FamilyName = details?.FamilyName,
        FamilyNameAr = details?.FamilyNameAr,
        Town = details?.Town,
        TownAr = details?.TownAr,
        Address = details?.Address,
        Occupation = details?.Occupation,
        About = details?.About,
        UpdatedAt = at
    };

    // The optional personal details, trimmed; blank clears a field. Only "about" may span lines. Each language is kept as typed.
    private static AccountProfile Details(UpdateAccountProfileDto request) => new()
    {
        GivenName = Optional(request.GivenName, "Given name", 100),
        GivenNameAr = Optional(request.GivenNameAr, "Arabic given name", 100),
        FamilyName = Optional(request.FamilyName, "Family name", 100),
        FamilyNameAr = Optional(request.FamilyNameAr, "Arabic family name", 100),
        Town = Optional(request.Town, "Town", 200),
        TownAr = Optional(request.TownAr, "Arabic town", 200),
        Address = Optional(request.Address, "Address", 300),
        Occupation = Optional(request.Occupation, "Occupation", 200),
        About = Optional(request.About, "About", 1000, true)
    };

    private static string? Optional(string? value, string name, int maximum, bool multiline = false)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var text = Guard.Text(value, name, maximum);
        if (text.Any(c => char.IsControl(c) && !(multiline && c is '\n' or '\r' or '\t')))
            throw new DomainException("invalid_profile", name + " must be plain text.");
        return text;
    }

    private static bool SameDetails(AccountProfileDto current, AccountProfile details) =>
        current.GivenName == details.GivenName && current.GivenNameAr == details.GivenNameAr && current.FamilyName == details.FamilyName
        && current.FamilyNameAr == details.FamilyNameAr && current.Town == details.Town && current.TownAr == details.TownAr
        && current.Address == details.Address && current.Occupation == details.Occupation && current.About == details.About;

    private static List<RecordChange> Changes(ParishUser user, Versioned<AccountProfile>? previous, AccountProfile profile) =>
    [
        // This fence also prevents a concurrent credential, eligibility or other account update from being overwritten.
        RecordChange.Replace("account", "account", user, user.PersistenceVersion!),
        previous is null ? RecordChange.Create(ProfileKey, ProfileKey, profile) : RecordChange.Replace(ProfileKey, ProfileKey, profile, previous.Version)
    ];

    private async Task<AccountProfileResultDto> ResultAsync(Operation operation, AccountProfileCommit outcome, bool replay,
        string? name, string? language, AccountAppearanceDto appearance, AccountProfile? details, CancellationToken ct)
    {
        // details is null for an appearance-only reset, which says nothing about the name, language or details.
        var current = await GetAsync(ct);
        return new AccountProfileResultDto
        {
            OperationId = operation.Id,
            Status = replay ? "AlreadyApplied" : "Saved",
            AppliedAt = outcome.AppliedAt,
            RequestedValuesAreCurrent = SameAppearance(current.Value.Appearance, appearance)
                && (details is null || (current.Value.DisplayName == name && current.Value.PreferredLanguage == language && SameDetails(current.Value, details))),
            Current = current
        };
    }

    private static Versioned<AccountProfileDto> Project(ParishUser user, AccountProfile? profile)
    {
        if (profile is not null && profile.AccountId != user.Id)
            throw new DomainException("profile_unavailable", "The account profile is unavailable.", FailureKind.Unavailable);
        return new Versioned<AccountProfileDto>
        {
            Version = user.PersistenceVersion!,
            Value = new AccountProfileDto
            {
                AccountId = user.Id,
                DisplayName = user.DisplayName,
                PreferredLanguage = profile?.PreferredLanguage,
                Appearance = Normalize(profile is null ? new AccountAppearanceDto() : new AccountAppearanceDto
                { Mode = profile.Mode, Scheme = profile.Scheme, PrimaryColor = profile.PrimaryColor }),
                GivenName = profile?.GivenName,
                GivenNameAr = profile?.GivenNameAr,
                FamilyName = profile?.FamilyName,
                FamilyNameAr = profile?.FamilyNameAr,
                Town = profile?.Town,
                TownAr = profile?.TownAr,
                Address = profile?.Address,
                Occupation = profile?.Occupation,
                About = profile?.About,
                IsConfigured = profile is not null,
                UpdatedAt = profile?.UpdatedAt
            }
        };
    }

    private static bool SameAppearance(AccountAppearanceDto left, AccountAppearanceDto right) =>
        left.Mode == right.Mode && left.Scheme == right.Scheme && left.PrimaryColor == right.PrimaryColor;

    private static AccountAppearanceDto Normalize(AccountAppearanceDto? value)
    {
        if (value is null || value.Mode is not ("light" or "dark"))
            throw new DomainException("invalid_appearance", "Choose light or dark appearance.");
        string primary;
        if (Presets.TryGetValue(value.Scheme ?? string.Empty, out var preset))
        {
            if (value.PrimaryColor is not null && !string.Equals(value.PrimaryColor, preset, StringComparison.OrdinalIgnoreCase))
                throw new DomainException("invalid_appearance", "Preset color must match its scheme. Choose custom for another primary color.");
            primary = preset;
        }
        else if (value.Scheme == "custom" && value.PrimaryColor is { Length: 7 } color && color[0] == '#' && color.Skip(1).All(Uri.IsHexDigit))
            primary = color.ToUpperInvariant();
        else
            throw new DomainException("invalid_appearance", "Choose a known preset or one six-digit custom primary color.");
        return new AccountAppearanceDto { Mode = value.Mode, Scheme = value.Scheme!, PrimaryColor = primary };
    }

    private static string ReadableLink(string primary, string surface, bool dark)
    {
        var rgb = Channels(primary);
        var target = dark ? 255 : 0;
        for (var step = 0; step <= 255; step++)
        {
            var mixed = "#" + string.Concat(rgb.Select(channel => ((int)Math.Round(channel + (target - channel) * step / 255d)).ToString("X2", CultureInfo.InvariantCulture)));
            if (Contrast(mixed, surface) >= 4.5)
                return mixed;
        }
        return dark ? "#FFFFFF" : "#000000";
    }

    private static int[] Channels(string hex) => [Convert.ToInt32(hex.Substring(1, 2), 16), Convert.ToInt32(hex.Substring(3, 2), 16), Convert.ToInt32(hex.Substring(5, 2), 16)];

    private static double Luminance(string hex)
    {
        var linear = Channels(hex).Select(channel => channel / 255d).Select(value => value <= 0.04045 ? value / 12.92 : Math.Pow((value + 0.055) / 1.055, 2.4)).ToArray();
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    }

    private static double Contrast(string first, string second)
    {
        var a = Luminance(first);
        var b = Luminance(second);
        return (Math.Max(a, b) + 0.05) / (Math.Min(a, b) + 0.05);
    }
}
