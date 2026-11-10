// Purpose: manages the parish music library: versioned works with metadata, materials and per-use rights, search and withdrawal.
// Main functions: PublishAsync, WithdrawAsync, GetAsync and SearchAsync; versions are immutable so plans that pin one never change.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Scheduling;

public class MusicLibraryService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "music:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested music is unavailable.", FailureKind.NotFound);

    private async Task<Versioned<Parish>> AuthorizeAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        return root;
    }

    public async Task<MusicVersionDto> PublishAsync(string parish, PublishMusicDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.MusicManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "music:v2");
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        if (request.AlternateTitles is null || request.AlternateTitles.Length > 10 || request.MediaLinks is null || request.MediaLinks.Length > 10
            || request.MediaLinks.Any(link => !Uri.TryCreate(link, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps))
            throw new DomainException("invalid_input", "Use up to ten alternate titles and up to ten HTTPS media links.");
        var item = new MusicVersion
        {
            Id = op.Id, ParishId = parish, WorkId = op.Id, Title = Guard.Text(request.Title, "Title", 300),
            AlternateTitles = request.AlternateTitles.Select(x => Guard.Text(x, "Alternate title", 300)).ToArray(),
            Language = Guard.Text(request.Language, "Language", 10), Rite = Optional(request.Rite, 100), Season = Optional(request.Season, 100),
            Composer = Optional(request.Composer, 200), MusicalKey = Optional(request.MusicalKey, 20), Instrumentation = Optional(request.Instrumentation, 200),
            Category = Optional(request.Category, 100), Lyrics = Optional(request.Lyrics, 50000), Chords = Optional(request.Chords, 50000),
            Notes = Optional(request.Notes, 5000), MediaLinks = [.. request.MediaLinks],
            // Rights are recorded per use; holding a file grants nothing by itself.
            RightsBasis = Guard.Text(request.RightsBasis, "Rights basis", 2000), Attribution = Optional(request.Attribution, 1000),
            DownloadAllowed = request.DownloadAllowed, PrintAllowed = request.PrintAllowed, ProjectionAllowed = request.ProjectionAllowed,
            CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", root.Value, root.Version) };
        if (request.SupersedesId is { } supersedes)
        {
            var old = await ReadAsync(parish, Guard.Id(supersedes), ct);
            if (old.Value.Status != "Active")
                throw new DomainException("invalid_music_state", "Only the active version of a work can be revised.", FailureKind.Conflict);
            item.WorkId = old.Value.WorkId;
            item.SupersedesId = old.Value.Id;
            old.Value.Status = "Superseded";
            changes.Add(RecordChange.Replace(Key(old.Value.Id), "music", old.Value, old.Version));
        }
        changes.Add(RecordChange.Create(Key(item.Id), "music", item));
        await records.CommitAsync(Scope(parish), op, "music.publish_version", item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<MusicVersionDto> WithdrawAsync(string parish, string id, WithdrawMusicDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.MusicManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "music-withdraw:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var row = await ReadAsync(parish, id, ct);
        if (row.Value.Status == "Withdrawn")
            throw new DomainException("invalid_music_state", "This version is already withdrawn.", FailureKind.Conflict);
        Guard.Text(request.Reason, "Withdrawal reason", 2000);
        row.Value.Status = "Withdrawn";
        await records.CommitAsync(Scope(parish), op, "music.withdraw", id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Replace(Key(id), "music", row.Value, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = row.Value.Status }, ct);
        return Project(row.Value);
    }

    public async Task<Versioned<MusicVersionDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.ScheduleRead, ct);
        var row = await ReadAsync(parish, id, ct);
        return new Versioned<MusicVersionDto> { Version = row.Version, Value = Project(row.Value) };
    }

    // ponytail: in-memory filtering over at most 2000 versions per parish; move to indexed/full-text search if libraries outgrow it.
    public async Task<Page<MusicVersionDto>> SearchAsync(string parish, string? text, string? language, string? season, string? rite,
        bool includeInactive, int size, int offset, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.ScheduleRead, ct);
        if (size is < 1 or > 100 || offset is < 0 or > 2000)
            throw new DomainException("invalid_page", "Use 1–100 rows and an offset of 0–2000.");
        var rows = await records.CollectAsync<MusicVersion>(Scope(parish), "music", ct, 2000);
        var matches = rows.Select(r => r.Value)
            .Where(x => includeInactive || x.Status == "Active")
            .Where(x => string.IsNullOrWhiteSpace(text) || x.Title.Contains(text, StringComparison.OrdinalIgnoreCase)
                || x.AlternateTitles.Any(a => a.Contains(text, StringComparison.OrdinalIgnoreCase))
                || (x.Composer?.Contains(text, StringComparison.OrdinalIgnoreCase) ?? false))
            .Where(x => language is null || string.Equals(x.Language, language, StringComparison.OrdinalIgnoreCase))
            .Where(x => season is null || string.Equals(x.Season, season, StringComparison.OrdinalIgnoreCase))
            .Where(x => rite is null || string.Equals(x.Rite, rite, StringComparison.OrdinalIgnoreCase))
            .OrderBy(x => x.Title, StringComparer.OrdinalIgnoreCase).ThenBy(x => x.Id, StringComparer.Ordinal).ToList();
        return new Page<MusicVersionDto>
        {
            Items = matches.Skip(offset).Take(size).Select(Project).ToArray(),
            ContinuationToken = offset + size < matches.Count ? (offset + size).ToString(System.Globalization.CultureInfo.InvariantCulture) : null
        };
    }

    private static string? Optional(string? value, int max) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, "Field", max);

    private async Task<Versioned<MusicVersion>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<MusicVersion>(Scope(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static MusicVersionDto Project(MusicVersion x) => new()
    {
        Id = x.Id, WorkId = x.WorkId, Title = x.Title, AlternateTitles = [.. x.AlternateTitles], Language = x.Language, Rite = x.Rite, Season = x.Season,
        Composer = x.Composer, MusicalKey = x.MusicalKey, Instrumentation = x.Instrumentation, Category = x.Category,
        // Withdrawn versions keep their metadata for pinned history but no longer offer their materials.
        Lyrics = x.Status == "Withdrawn" ? null : x.Lyrics, Chords = x.Status == "Withdrawn" ? null : x.Chords, Notes = x.Notes,
        MediaLinks = x.Status == "Withdrawn" ? [] : [.. x.MediaLinks], RightsBasis = x.RightsBasis, Attribution = x.Attribution,
        DownloadAllowed = x.Status != "Withdrawn" && x.DownloadAllowed, PrintAllowed = x.Status != "Withdrawn" && x.PrintAllowed,
        ProjectionAllowed = x.Status != "Withdrawn" && x.ProjectionAllowed, Status = x.Status, SupersedesId = x.SupersedesId,
        CreatedBy = x.CreatedBy, CreatedAt = x.CreatedAt
    };
}
