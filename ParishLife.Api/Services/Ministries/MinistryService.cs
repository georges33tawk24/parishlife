// Purpose: manages parish ministry drafts, explicit approval/publication and intake with safe public projections.
// Main functions: SaveAsync, ActAsync, GetAsync, MemberInfoAsync, ListAsync, PublicAsync; explicit projections isolate office, member and public facts.

using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Ministries;

public class MinistryService(IRecordTransactions records, MinistryAccess authorization, IParishAccess access,
    IParishRepository parishes, ICurrentActor actor, TimeProvider clock)
{
    public async Task<MinistryDto> SaveAsync(string parish, string? id, SaveMinistryDto request, CancellationToken ct)
    {
        var root = await authorization.OfficeAsync(parish, ct);
        var scope = MinistryAccess.Scope(parish);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-draft:v2:" + id);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is { } replay)
            return View((await authorization.ReadAsync(parish, replay.Id, ct)).Value);
        var old = id is null ? null : await authorization.ReadAsync(parish, id, ct);
        if (old is not null && old.Value.Status != "Draft")
            throw MinistryAccess.State("Only a draft may be edited. Active approved descriptions require a deliberate reviewed revision.");
        if (request.Kind is not ("Ministry" or "Choir" or "Class" or "Committee" or "Team"))
            throw new DomainException("invalid_ministry_kind", "Use Ministry, Choir, Class, Committee or Team.");
        var value = new Ministry
        {
            Id = id ?? op.Id, ParishId = parish, Name = Guard.Text(request.Name, "Name", 200), Kind = request.Kind,
            Purpose = Guard.Text(request.Purpose, "Purpose", 4000), Status = "Draft", CreatedAt = old?.Value.CreatedAt ?? op.At,
            CreatedBy = old?.Value.CreatedBy ?? actor.AccountId,
            EligibilityPolicyReference = string.IsNullOrWhiteSpace(request.EligibilityPolicyReference) ? null : Guard.Text(request.EligibilityPolicyReference, "Eligibility policy reference", 1000),
            PublicInformation = string.IsNullOrWhiteSpace(request.PublicInformation) ? null : Guard.Text(request.PublicInformation, "Public information", 4000),
            PolicyRevision = (old?.Value.PolicyRevision ?? 0) + 1
        };
        await records.CommitAsync(scope, op, "ministry.save_draft", value.Id,
            [MinistryAccess.Fence(root), old is null ? RecordChange.Create("ministry:" + value.Id, "ministry", value)
                : RecordChange.Replace("ministry:" + value.Id, "ministry", value, Versions.Require(request.Version))],
            new CommandResult { Id = value.Id, Status = value.Status }, ct);
        return View((await authorization.ReadAsync(parish, value.Id, ct)).Value);
    }

    public async Task<MinistryDto> ActAsync(string parish, string ministry, MinistryActionDto request, CancellationToken ct)
    {
        var cleanup = request.Action is "unpublish" or "archive" or "close-applications";
        var root = request.Action is "approve" or "publish" or "open-applications"
            ? await authorization.PriestAsync(parish, ct, !cleanup) : await authorization.OfficeAsync(parish, ct, !cleanup);
        if (request.Action is "publish" or "unpublish") await access.RequireAsync(parish, Permissions.PublishingManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "ministry-action:v2:" + ministry);
        var scope = MinistryAccess.Scope(parish);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return View((await authorization.ReadAsync(parish, ministry, ct)).Value);
        var row = await authorization.ReadAsync(parish, ministry, ct);
        var value = row.Value;
        Guard.Text(request.Reason, "Action reason", 2000);
        switch (request.Action)
        {
            case "approve" when value.Status == "Draft":
                value.Status = "Active"; value.ApprovedBy = actor.AccountId; value.ApprovedAt = op.At;
                break;
            case "publish" when value.Status == "Active" && !value.PublicListed:
                value.PublicListed = true; value.PublishedBy = actor.AccountId; value.PublishedAt = op.At;
                break;
            case "unpublish" when value.PublicListed:
                value.PublicListed = false;
                break;
            case "open-applications" when value.Status == "Active" && !value.ApplicationsOpen:
                if (string.IsNullOrWhiteSpace(value.EligibilityPolicyReference))
                    throw MinistryAccess.State("Record the actual eligibility and consent policy reference before approving and opening intake.");
                value.ApplicationsOpen = true;
                break;
            case "close-applications" when value.ApplicationsOpen:
                value.ApplicationsOpen = false;
                break;
            case "archive" when value.Status is "Draft" or "Active":
                value.Status = "Archived"; value.PublicListed = false; value.ApplicationsOpen = false;
                break;
            case "restore" when value.Status == "Archived":
                value.Status = "Draft"; value.ApprovedBy = null; value.ApprovedAt = null;
                break;
            default: throw MinistryAccess.State("This action is unavailable for the current ministry state.");
        }
        var history = new MinistryLifecycleHistory
        {
            Id = op.Id, MinistryId = ministry, Action = request.Action, Status = value.Status,
            ActorId = actor.AccountId, ActingAppointmentId = actor.ActingAppointmentId, At = op.At, Reason = request.Reason.Trim()
        };
        await records.CommitAsync(scope, op, "ministry." + request.Action, ministry,
            [MinistryAccess.Fence(root), RecordChange.Replace("ministry:" + ministry, "ministry", value, Versions.Require(request.Version)),
                RecordChange.Create("ministryLifecycleHistory:" + op.Id, "ministryLifecycleHistory", history)],
            new CommandResult { Id = ministry, Status = value.Status }, ct);
        return View((await authorization.ReadAsync(parish, ministry, ct)).Value);
    }

    public async Task<Versioned<MinistryDto>> GetAsync(string parish, string ministry, CancellationToken ct)
    {
        var row = await authorization.ReaderAsync(parish, ministry, ct);
        return new() { Value = View(row.Value), Version = row.Version };
    }

    public async Task<MemberMinistryDto> MemberInfoAsync(string parish, string ministry, CancellationToken ct)
    {
        var link = await authorization.OwnLinkAsync(parish, ct);
        var group = await authorization.ReadAsync(parish, ministry, ct);
        var member = await records.ReadAsync<MinistryMembership>(MinistryAccess.Scope(parish),
            MinistryAccess.MemberKey(ministry, link.Value.PersonId), ct);
        if (group.Value.Status != "Active" || group.Value.ApprovedAt is null
            || member?.Value.Current(clock.GetUtcNow()) != true || member.Value.MinistryId != ministry
            || member.Value.PersonId != link.Value.PersonId)
            throw MinistryAccess.Missing();
        return new()
        {
            Id = group.Value.Id,
            ParishId = group.Value.ParishId,
            Name = group.Value.Name,
            Kind = group.Value.Kind,
            Purpose = group.Value.Purpose,
            PublicInformation = group.Value.PublicInformation,
            Status = group.Value.Status
        };
    }

    public async Task<Page<Versioned<MinistryDto>>> ListAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await authorization.OfficeAsync(parish, ct, false);
        var page = await records.PageAsync<Ministry>(MinistryAccess.Scope(parish), "ministry", size, cursor, ct);
        return new() { Items = page.Items.Select(row => new Versioned<MinistryDto> { Value = View(row.Value), Version = row.Version }).ToArray(), ContinuationToken = page.ContinuationToken };
    }
    public async Task<Page<PublicMinistryDto>> PublicAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        if (size is < 1 or > 100) throw new DomainException("invalid_page", "Use 1–100 rows.");
        if ((await parishes.GetAsync(parish, ct))?.Value.Status != ParishStatus.Verified) return new() { Items = [] };
        var page = await records.PageAsync<Ministry>(MinistryAccess.Scope(parish), "ministry", size, cursor, ct,
            new RecordCondition { Path = "publicListed", Comparison = "eq", Value = true },
            new RecordCondition { Path = "status", Comparison = "eq", Value = "Active" });
        var available = (await parishes.GetCoveragesAsync(parish, ct)).Any(c => c.Includes("ministries", clock.GetUtcNow()));
        return new()
        {
            Items = page.Items.Where(row => row.Value.ParishId == parish && row.Value.ApprovedAt is not null && row.Value.PublishedAt is not null)
                .Select(row => PublicView(row.Value, available)).ToArray(), ContinuationToken = page.ContinuationToken
        };
    }
    private static MinistryDto View(Ministry value) => new()
    {
        Id = value.Id, ParishId = value.ParishId, Name = value.Name, Kind = value.Kind, Purpose = value.Purpose,
        Status = value.Status, PublicListed = value.PublicListed, ApplicationsOpen = value.ApplicationsOpen,
        EligibilityPolicyReference = value.EligibilityPolicyReference, PublicInformation = value.PublicInformation, PolicyRevision = value.PolicyRevision
    };
    private static PublicMinistryDto PublicView(Ministry value, bool available) => new()
    {
        Id = value.Id, ParishId = value.ParishId, Name = value.Name, Kind = value.Kind,
        Purpose = value.Purpose, PublicInformation = value.PublicInformation, ApplicationsOpen = value.ApplicationsOpen && available
    };
}
