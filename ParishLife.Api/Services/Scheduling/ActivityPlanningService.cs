// Purpose: retains service-plan drafts and music version workflows for their later reviewed API integration.
// Main functions: SavePlanAsync, PublishMusicAsync; helpers apply scoped permissions and entitlement without adding a production project.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Scheduling;

public class ActivityPlanningService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private Operation Op(Guid id, object request, string target) => actor.CreateOperation(id, request, clock, target);
    private async Task Authorize(string parish, string permission, string module, CancellationToken ct)
    {
        await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, module, ct);
    }
    private static DomainException Missing() => new("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);

    public async Task<ServicePlan> SavePlanAsync(string parish, string? id, SavePlanDto request, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleManage, "core", ct);
        var op = Op(request.OperationId, request, "service-plan:" + id);
        if (await records.ReplayAsync<ServicePlan>(Scope(parish), op, ct) is { } replay)
            return replay;
        var occurrence = await records.ReadAsync<CalendarEvent>(Scope(parish), "event:" + Guard.Id(request.EventId), ct) ?? throw Missing();
        if (request.Items.Length > 80 || request.Items.Any(x => x.Minutes < 0) || request.Items.Sum(x => x.Minutes) > (occurrence.Value.EndsAt - occurrence.Value.StartsAt).TotalMinutes)
            throw new DomainException("invalid_plan", "The running order must fit the booked event duration.");
        var current = id is null ? null : await records.ReadAsync<ServicePlan>(Scope(parish), "servicePlan:" + id, ct) ?? throw Missing();
        if (current?.Value.Status == "Approved")
            throw new DomainException("approved_plan", "Create a reviewed new plan version.", FailureKind.Conflict);
        var item = new ServicePlan
        {
            Id = id ?? op.Id,
            ParishId = parish,
            EventId = occurrence.Value.Id,
            Title = Guard.Text(request.Title, "Title"),
            Status = "Draft",
            Items = request.Items,
            CreatedBy = actor.AccountId
        };
        return await records.CommitAsync(Scope(parish), op, "service_plan.save", item.Id, [current is null ? RecordChange.Create("servicePlan:" + item.Id, "servicePlan", item) : RecordChange.Replace("servicePlan:" + item.Id, "servicePlan", item, Versions.Require(request.Version))], item, ct);
    }

    public async Task<MusicVersion> PublishMusicAsync(string parish, PublishMusicDto request, CancellationToken ct)
    {
        await Authorize(parish, Permissions.ScheduleManage, "core", ct);
        var op = Op(request.OperationId, request, "music");
        var item = new MusicVersion
        {
            Id = op.Id,
            ParishId = parish,
            Title = Guard.Text(request.Title, "Title"),
            Language = Guard.Text(request.Language, "Language", 10),
            Content = Guard.Text(request.Content, "Content", 50000),
            RightsStatement = Guard.Text(request.RightsStatement, "Rights statement", 2000),
            DownloadAllowed = request.DownloadAllowed,
            CreatedBy = actor.AccountId,
            CreatedAt = op.At,
            SupersedesId = request.SupersedesId?.ToString("N")
        };
        return await records.CommitAsync(Scope(parish), op, "music.publish_version", item.Id, [RecordChange.Create("music:" + item.Id, "music", item)], item, ct);
    }
}
