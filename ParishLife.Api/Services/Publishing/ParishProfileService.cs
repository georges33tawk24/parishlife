// Purpose: a parish's public profile (contacts, Arabic name and locality, rite, Mass and office times, visitor notes, feast, livestream and
// WhatsApp links) and its photographs. Editors (publishing.manage with MFA and the core module) save a draft and explicitly publish or unpublish
// it; visitors read only the published copy of a verified parish. Photos are uploaded into the private evidence store as Private and served to
// visitors only after an explicit publish. Clergy are listed publicly only when the published profile asks for it, and only from current
// accepted priest appointments. Links are stored as entered: nothing is fetched, embedded or called.
// Main functions: GetAsync, SaveAsync, ActAsync, UploadPhotoAsync, PhotoActAsync, DownloadPhotoAsync (editors); PublicAsync and
// PublicPhotoAsync (visitors); Normalize validates and trims the editor's text.

using System.Net.Mail;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Publishing;

public class ParishProfileService(IRecordTransactions records, IParishRepository parishes, IParishAccess access, IEvidenceStore store,
    MfaAccountAccess proof, ICurrentActor actor, IUserStore<ParishUser> users, TimeProvider clock)
{
    internal const string Key = "publicProfile";
    internal const long MaximumPhotoBytes = 5 * 1024 * 1024;
    internal const int MaximumPhotos = 12;
    private const int MaximumClergy = 50;
    private static readonly string[] WhatsAppHosts = ["wa.me", "chat.whatsapp.com", "whatsapp.com", "www.whatsapp.com"];

    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string PhotoKey(string id) => "profilePhoto:" + id;
    private static DomainException Missing(string what = "The parish profile") => new("resource_not_found", what + " is unavailable.", FailureKind.NotFound);
    private static DomainException Invalid(string message) => new("invalid_input", message);
    private static DomainException Conflict() => new("write_conflict", "The parish profile changed; reload it before saving.", FailureKind.Conflict);
    internal static string PhotoUrl(string parish, string id) => "/api/public/parishes/" + parish + "/profile/photos/" + id;
    internal static string FeedUrl(string parish) => "/api/public/parishes/" + parish + "/calendar.ics";

    private async Task<Versioned<Parish>> EditorAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.PublishingManage, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        return root;
    }

    public async Task<Versioned<ParishProfileDto>> GetAsync(string parish, CancellationToken ct)
    {
        await EditorAsync(parish, ct);
        return await ViewAsync(parish, ct);
    }

    private async Task<Versioned<ParishProfileDto>> ViewAsync(string parish, CancellationToken ct)
    {
        var row = await ReadAsync(parish, ct);
        var photos = (await PhotosAsync(parish, ct)).OrderBy(p => p.Value.UploadedAt).Select(ProjectPhoto).ToArray();
        if (row is null)
            return new Versioned<ParishProfileDto> { Version = string.Empty, Value = new ParishProfileDto { ParishId = parish, Photos = photos } };
        var value = row.Value;
        var draft = Project(value.Draft);
        var published = value.Published is null ? null : Project(value.Published);
        return new Versioned<ParishProfileDto>
        {
            Version = row.Version,
            Value = new ParishProfileDto
            {
                ParishId = parish, Draft = draft, Published = published, DraftUpdatedBy = value.DraftUpdatedBy, DraftUpdatedAt = value.DraftUpdatedAt,
                PublishedBy = value.PublishedBy, PublishedAt = value.PublishedAt, Photos = photos,
                Status = value.Published is null ? "NotPublished" : Same(value.Draft, value.Published) ? "Published" : "PublishedWithChanges"
            }
        };
    }

    public async Task<Versioned<ParishProfileDto>> SaveAsync(string parish, SaveParishProfileDto request, CancellationToken ct)
    {
        await EditorAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "parish-profile:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await ViewAsync(parish, ct);
        var draft = Normalize(request.Profile ?? throw Invalid("Send the profile."));
        var previous = await ReadAsync(parish, ct);
        if (previous is null && !string.IsNullOrEmpty(request.Version) || previous is not null && previous.Version != Versions.Require(request.Version))
            throw Conflict();
        var value = previous?.Value ?? new ParishProfile { ParishId = parish };
        value.Draft = draft;
        value.DraftUpdatedBy = actor.AccountId;
        value.DraftUpdatedAt = op.At;
        await EditorAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, "parish.profile_draft_saved", parish,
            [previous is null ? RecordChange.Create(Key, "parishProfile", value) : RecordChange.Replace(Key, "parishProfile", value, previous.Version)],
            new CommandResult { Id = parish, Status = "Draft" }, ct);
        return await ViewAsync(parish, ct);
    }

    // Publishing copies the current draft exactly; unpublishing removes the public copy and keeps the draft.
    public async Task<Versioned<ParishProfileDto>> ActAsync(string parish, ParishProfileActionDto request, CancellationToken ct)
    {
        await EditorAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "parish-profile-action:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return await ViewAsync(parish, ct);
        var row = await ReadAsync(parish, ct) ?? throw new DomainException("invalid_profile_state", "Save the profile before publishing it.", FailureKind.Conflict);
        if (row.Version != Versions.Require(request.Version))
            throw Conflict();
        var value = row.Value;
        switch (request.Action)
        {
            case "publish":
                value.Published = Copy(value.Draft);
                value.PublishedBy = actor.AccountId;
                value.PublishedAt = op.At;
                break;
            case "unpublish":
                if (value.Published is null)
                    throw new DomainException("invalid_profile_state", "The profile is not published.", FailureKind.Conflict);
                value.Published = null;
                value.PublishedBy = null;
                value.PublishedAt = null;
                break;
            default:
                throw Invalid("Choose publish or unpublish.");
        }
        await EditorAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, "parish.profile_" + request.Action, parish,
            [RecordChange.Replace(Key, "parishProfile", value, row.Version)], new CommandResult { Id = parish, Status = request.Action }, ct);
        return await ViewAsync(parish, ct);
    }

    public async Task<ParishProfilePhotoDto> UploadPhotoAsync(string parish, Guid operationId, string declaredType, byte[] content, string? caption, string? captionAr,
        CancellationToken ct)
    {
        await EditorAsync(parish, ct);
        if (content.Length == 0 || content.Length > MaximumPhotoBytes)
            throw new DomainException("invalid_file", "Photos must be between 1 byte and 5 MB.");
        var type = Detect(content);
        if (type is null || type != declaredType)
            throw new DomainException("invalid_file", "Upload a JPEG, PNG or WebP image whose content matches its type.");
        var digest = Convert.ToHexString(SHA256.HashData(content));
        var op = actor.CreateOperation(operationId, new { type, size = content.Length, digest, caption, captionAr }, clock, "parish-profile-photo:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return ProjectPhoto(await ReadPhotoAsync(parish, prior.Id, ct));
        if ((await PhotosAsync(parish, ct)).Count(p => p.Value.Status != "Removed") >= MaximumPhotos)
            throw new DomainException("invalid_file_state", "A parish profile holds up to " + MaximumPhotos + " photos; remove one first.", FailureKind.Conflict);
        var photo = new ParishProfilePhoto
        {
            Id = op.Id, ParishId = parish, ContentType = type, Size = content.Length, Sha256 = digest, StoragePath = "profile-photos/" + parish + "/" + op.Id,
            Caption = Line(caption, "Caption", 300), CaptionAr = Line(captionAr, "CaptionAr", 300), UploadedBy = actor.AccountId, UploadedAt = op.At
        };
        // The complete private object exists before its metadata commits; it stays private until an explicit publish.
        await store.PutAsync(photo.StoragePath, content, type, ct);
        await EditorAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, "parish.profile_photo_uploaded", photo.Id, [RecordChange.Create(PhotoKey(photo.Id), "parishProfilePhoto", photo)],
            new CommandResult { Id = photo.Id, Status = photo.Status }, ct);
        return ProjectPhoto(await ReadPhotoAsync(parish, photo.Id, ct));
    }

    public async Task<ParishProfilePhotoDto> PhotoActAsync(string parish, string id, ParishProfilePhotoActionDto request, CancellationToken ct)
    {
        await EditorAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "parish-profile-photo-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return ProjectPhoto(await ReadPhotoAsync(parish, id, ct));
        var row = await ReadPhotoAsync(parish, id, ct);
        if (row.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The photo changed; reload it before saving.", FailureKind.Conflict);
        var photo = row.Value;
        if (photo.Status == "Removed")
            throw new DomainException("invalid_file_state", "This photo was removed.", FailureKind.Conflict);
        switch (request.Action)
        {
            case "publish":
                photo.Status = "Published";
                photo.PublishedBy = actor.AccountId;
                photo.PublishedAt = op.At;
                break;
            case "unpublish":
                photo.Status = "Private";
                photo.PublishedBy = null;
                photo.PublishedAt = null;
                break;
            case "remove":
                photo.Status = "Removed";
                photo.PublishedBy = null;
                photo.PublishedAt = null;
                photo.RemovedBy = actor.AccountId;
                photo.RemovedAt = op.At;
                break;
            case "caption":
                photo.Caption = Line(request.Caption, "Caption", 300);
                photo.CaptionAr = Line(request.CaptionAr, "CaptionAr", 300);
                break;
            default:
                throw Invalid("Choose publish, unpublish, remove or caption.");
        }
        await EditorAsync(parish, ct);
        await records.CommitAsync(Scope(parish), op, "parish.profile_photo_" + request.Action, id,
            [RecordChange.Replace(PhotoKey(id), "parishProfilePhoto", photo, row.Version)], new CommandResult { Id = id, Status = photo.Status }, ct);
        return ProjectPhoto(await ReadPhotoAsync(parish, id, ct));
    }

    // Editors preview any photo of their parish, including private and removed ones.
    public async Task<(byte[] Content, string ContentType)> DownloadPhotoAsync(string parish, string id, CancellationToken ct)
    {
        await EditorAsync(parish, ct);
        return await ContentAsync((await ReadPhotoAsync(parish, id, ct)).Value, ct);
    }

    public async Task<PublicParishProfileDto> PublicAsync(string parish, CancellationToken ct)
    {
        var root = await VerifiedAsync(parish, ct);
        var published = (await ReadAsync(parish, ct))?.Value is { Published: { } copy } value ? (value, copy) : throw Missing();
        var photos = (await PhotosAsync(parish, ct)).Select(p => p.Value).Where(p => p.Status == "Published" && p.ParishId == parish)
            .OrderBy(p => p.UploadedAt).Select(p => new PublicParishPhotoDto { Id = p.Id, Url = PhotoUrl(parish, p.Id), Caption = p.Caption, CaptionAr = p.CaptionAr })
            .ToArray();
        return new PublicParishProfileDto
        {
            ParishId = parish, Name = root.Name, Locality = root.Locality, Profile = Project(published.copy), Photos = photos,
            Clergy = published.copy.ShowClergy ? await ClergyAsync(root, ct) : [], CalendarFeed = FeedUrl(parish), PublishedAt = published.value.PublishedAt
        };
    }

    public async Task<(byte[] Content, string ContentType)> PublicPhotoAsync(string parish, string id, CancellationToken ct)
    {
        await VerifiedAsync(parish, ct);
        var photo = (await ReadPhotoAsync(parish, id, ct)).Value;
        return photo.Status == "Published" ? await ContentAsync(photo, ct) : throw Missing("The photo");
    }

    // The published Arabic name and locality of each listed parish, for the public directory; nothing else from the profile.
    internal async Task<ParishProfileContent?> PublishedAsync(string parish, CancellationToken ct) => (await ReadAsync(parish, ct))?.Value.Published;

    private async Task<Parish> VerifiedAsync(string parish, CancellationToken ct)
        => (await parishes.GetAsync(parish, ct))?.Value is { Status: ParishStatus.Verified } root ? root : throw Missing();

    // Current accepted priest appointments in the parish's current jurisdiction, named by the appointed account's display name.
    private async Task<PublicClergyDto[]> ClergyAsync(Parish parish, CancellationToken ct)
    {
        if (parish.JurisdictionArchdioceseId is not { } archdiocese)
            return [];
        var now = clock.GetUtcNow();
        var clergy = new List<(bool Head, PublicClergyDto Item)>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var row in await records.CollectAsync<StaffAppointment>(Scope(parish.Id), "staffAppointment", ct, 500))
        {
            var appointment = row.Value;
            if (appointment.Role != StaffAppointmentRole.Priest || appointment.ParishId != parish.Id || appointment.ArchdioceseId != archdiocese
                || !appointment.IsEffective(now) || !seen.Add(appointment.AccountId) || clergy.Count >= MaximumClergy)
                continue;
            var user = await users.FindByIdAsync(appointment.AccountId, ct);
            if (user is not { Active: true } || string.IsNullOrWhiteSpace(user.DisplayName))
                continue;
            var head = appointment.IsHead(now);
            clergy.Add((head, new PublicClergyDto { Name = user.DisplayName.Trim(), Role = head ? "ParishPriest" : "Priest" }));
        }
        return [.. clergy.OrderByDescending(c => c.Head).ThenBy(c => c.Item.Name, StringComparer.CurrentCultureIgnoreCase).Select(c => c.Item)];
    }

    private async Task<(byte[] Content, string ContentType)> ContentAsync(ParishProfilePhoto photo, CancellationToken ct)
    {
        var content = await store.OpenAsync(photo.StoragePath, ct) ?? throw Missing("The photo");
        if (content.Length != photo.Size || !string.Equals(Convert.ToHexString(SHA256.HashData(content)), photo.Sha256, StringComparison.Ordinal))
            throw new DomainException("evidence_integrity_unavailable", "The stored photo failed its integrity check; operator recovery is required.", FailureKind.Unavailable);
        return (content, photo.ContentType);
    }

    private async Task<Versioned<ParishProfile>?> ReadAsync(string parish, CancellationToken ct)
        => await records.ReadAsync<ParishProfile>(Scope(parish), Key, ct) is { } row && row.Value.ParishId == parish ? row : null;

    private async Task<IReadOnlyList<Versioned<ParishProfilePhoto>>> PhotosAsync(string parish, CancellationToken ct)
        => (await records.CollectAsync<ParishProfilePhoto>(Scope(parish), "parishProfilePhoto", ct, 500)).Where(p => p.Value.ParishId == parish).ToArray();

    private async Task<Versioned<ParishProfilePhoto>> ReadPhotoAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<ParishProfilePhoto>(Scope(parish), PhotoKey(id), ct) is { } row && row.Value.ParishId == parish && row.Value.Id == id
            ? row : throw Missing("The photo");

    // Only the actual bytes decide the type; names and declared types are not trusted.
    internal static string? Detect(byte[] content) => content switch
    {
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] => "image/png",
        [0x52, 0x49, 0x46, 0x46, _, _, _, _, 0x57, 0x45, 0x42, 0x50, ..] => "image/webp",
        _ => null
    };

    internal static ParishProfileContent Normalize(ParishProfileContentDto d) => new()
    {
        NameAr = Line(d.NameAr, "NameAr", 500), LocalityAr = Line(d.LocalityAr, "LocalityAr", 500), Rite = Line(d.Rite, "Rite", 120),
        RiteAr = Line(d.RiteAr, "RiteAr", 120), Phone = Phone(d.Phone), Email = Email(d.Email), Website = Https(d.Website, "Website"),
        Address = Block(d.Address, "Address", 500), AddressAr = Block(d.AddressAr, "AddressAr", 500), OfficeHours = Block(d.OfficeHours, "OfficeHours", 2000),
        OfficeHoursAr = Block(d.OfficeHoursAr, "OfficeHoursAr", 2000), MassTimes = Block(d.MassTimes, "MassTimes", 2000),
        MassTimesAr = Block(d.MassTimesAr, "MassTimesAr", 2000), ConfessionTimes = Block(d.ConfessionTimes, "ConfessionTimes", 2000),
        ConfessionTimesAr = Block(d.ConfessionTimesAr, "ConfessionTimesAr", 2000), Languages = Block(d.Languages, "Languages", 2000),
        LanguagesAr = Block(d.LanguagesAr, "LanguagesAr", 2000), Parking = Block(d.Parking, "Parking", 2000), ParkingAr = Block(d.ParkingAr, "ParkingAr", 2000),
        Accessibility = Block(d.Accessibility, "Accessibility", 2000), AccessibilityAr = Block(d.AccessibilityAr, "AccessibilityAr", 2000),
        Expect = Block(d.Expect, "Expect", 2000), ExpectAr = Block(d.ExpectAr, "ExpectAr", 2000), SacramentNotes = Block(d.SacramentNotes, "SacramentNotes", 2000),
        SacramentNotesAr = Block(d.SacramentNotesAr, "SacramentNotesAr", 2000), FeastName = Line(d.FeastName, "FeastName", 200),
        FeastNameAr = Line(d.FeastNameAr, "FeastNameAr", 200), FeastDate = Feast(d.FeastDate), LivestreamUrl = Https(d.LivestreamUrl, "LivestreamUrl"),
        WhatsAppUrl = WhatsApp(d.WhatsAppUrl), ShowClergy = d.ShowClergy
    };

    private static ParishProfileContentDto Project(ParishProfileContent c) => new()
    {
        NameAr = c.NameAr, LocalityAr = c.LocalityAr, Rite = c.Rite, RiteAr = c.RiteAr, Phone = c.Phone, Email = c.Email, Website = c.Website, Address = c.Address,
        AddressAr = c.AddressAr, OfficeHours = c.OfficeHours, OfficeHoursAr = c.OfficeHoursAr, MassTimes = c.MassTimes, MassTimesAr = c.MassTimesAr,
        ConfessionTimes = c.ConfessionTimes, ConfessionTimesAr = c.ConfessionTimesAr, Languages = c.Languages, LanguagesAr = c.LanguagesAr, Parking = c.Parking,
        ParkingAr = c.ParkingAr, Accessibility = c.Accessibility, AccessibilityAr = c.AccessibilityAr, Expect = c.Expect, ExpectAr = c.ExpectAr,
        SacramentNotes = c.SacramentNotes, SacramentNotesAr = c.SacramentNotesAr, FeastName = c.FeastName, FeastNameAr = c.FeastNameAr, FeastDate = c.FeastDate,
        LivestreamUrl = c.LivestreamUrl, WhatsAppUrl = c.WhatsAppUrl, ShowClergy = c.ShowClergy
    };

    // Round-trips through the DTO so the published copy can never share an instance with the draft.
    private static ParishProfileContent Copy(ParishProfileContent c) => Normalize(Project(c));

    private static bool Same(ParishProfileContent a, ParishProfileContent b)
        => System.Text.Json.JsonSerializer.Serialize(a) == System.Text.Json.JsonSerializer.Serialize(b);

    private static ParishProfilePhotoDto ProjectPhoto(Versioned<ParishProfilePhoto> row) => new()
    {
        Id = row.Value.Id, Version = row.Version, ContentType = row.Value.ContentType, Size = row.Value.Size, Caption = row.Value.Caption,
        CaptionAr = row.Value.CaptionAr, Status = row.Value.Status, UploadedBy = row.Value.UploadedBy, UploadedAt = row.Value.UploadedAt,
        PublishedBy = row.Value.PublishedBy, PublishedAt = row.Value.PublishedAt,
        PublicUrl = row.Value.Status == "Published" ? PhotoUrl(row.Value.ParishId, row.Value.Id) : null
    };

    private static string? Optional(string? value, string name, int maximum)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text))
            return null;
        return text.Length > maximum ? throw Invalid(name + " must not exceed " + maximum + " characters.") : text;
    }

    private static string? Line(string? value, string name, int maximum)
        => Optional(value, name, maximum) is { } text && text.Any(char.IsControl) ? throw Invalid(name + " must be a single line of plain text.") : Optional(value, name, maximum);

    private static string? Block(string? value, string name, int maximum)
        => Optional(value?.Replace("\r\n", "\n"), name, maximum) is { } text && text.Any(c => char.IsControl(c) && c is not '\n' and not '\t')
            ? throw Invalid(name + " must be plain text.") : Optional(value?.Replace("\r\n", "\n"), name, maximum);

    private static string? Phone(string? value)
        => Optional(value, "Phone", 40) is { } text && (!text.All(c => char.IsAsciiDigit(c) || c is '+' or ' ' or '-' or '(' or ')' or '.') || text.Count(char.IsAsciiDigit) < 6)
            ? throw Invalid("Give the office phone with digits, spaces, +, -, ( or ) only.") : Optional(value, "Phone", 40);

    private static string? Email(string? value)
    {
        var text = Optional(value, "Email", 254);
        if (text is null)
            return null;
        return MailAddress.TryCreate(text, out var address) && address.Address == text && !text.Any(char.IsWhiteSpace) ? text : throw Invalid("Give a valid office email address.");
    }

    private static string? Https(string? value, string name)
    {
        var text = Optional(value, name, 500);
        if (text is null)
            return null;
        return Uri.TryCreate(text, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && uri.Host.Length > 0 && string.IsNullOrEmpty(uri.UserInfo)
            && !text.Any(char.IsWhiteSpace) ? text : throw Invalid(name + " must be an https:// link.");
    }

    private static string? WhatsApp(string? value)
        => Https(value, "WhatsAppUrl") is { } text && !WhatsAppHosts.Contains(new Uri(text).Host.ToLowerInvariant())
            ? throw Invalid("WhatsAppUrl must be a wa.me or whatsapp.com link.") : Https(value, "WhatsAppUrl");

    private static string? Feast(string? value)
    {
        var text = Optional(value, "FeastDate", 5);
        if (text is null)
            return null;
        return text.Length == 5 && text[2] == '-' && int.TryParse(text[..2], out var month) && int.TryParse(text[3..], out var day) && text.Remove(2, 1).All(char.IsAsciiDigit)
            && month is >= 1 and <= 12 && day >= 1 && day <= DateTime.DaysInMonth(2024, month) ? text : throw Invalid("Give the feast day as MM-DD.");
    }
}
