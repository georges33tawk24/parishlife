// Purpose: manages service/activity plans linked to calendar events, reusable templates, review/approval and audience-specific outputs.
// Main functions: SaveAsync, ActAsync, GetAsync, ListAsync, OutputAsync, CelebrantsAsync; helpers compute the running-order timeline and blocking issues
// (overtime, fixed-start conflicts, unassigned required roles, missing celebrant) and project safe DTOs.
// A plan is the operational running order of an event; it never changes the event's booked times or resources.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Scheduling;

public class ServicePlanService(IRecordTransactions records, IParishAccess access, IClergyAuthority clergy, IAccountDirectory accounts,
    ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "servicePlan:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested plan is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_plan_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> AuthorizeAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        return root;
    }

    public async Task<ServicePlanDto> SaveAsync(string parish, string? id, SavePlanDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.ScheduleManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "service-plan:v2:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return (await GetAsync(parish, prior.Id, ct)).Value;
        var kind = request.EventId is null ? "Template" : "Plan";
        CalendarEvent? occurrence = null;
        if (request.EventId is { } eventId)
        {
            occurrence = (await records.ReadAsync<CalendarEvent>(Scope(parish), "event:" + Guard.Id(eventId), ct) ?? throw Missing()).Value;
            if (occurrence.ParishId != parish || occurrence.Status == "Cancelled")
                throw State("Plans are linked to an existing, uncancelled event of this parish.");
        }
        var coordinator = Guard.Id(request.CoordinatorAccountId);
        if (!await accounts.IsActiveVerifiedAsync(coordinator, ct))
            throw new DomainException("invalid_input", "The plan coordinator must be an active verified account.");
        var items = request.TemplateId is { } template && request.Items.Length == 0
            ? await FromTemplateAsync(parish, Guard.Id(template), ct)
            : await ItemsAsync(request.Items, kind, ct);
        Versioned<ServicePlan>? old = null;
        if (id is not null)
        {
            old = await ReadAsync(parish, id, ct);
            if (old.Value.Kind != kind || old.Value.Status is not ("Draft" or "Returned"))
                throw State("Only a draft or returned plan of the same kind can be edited; approved plans stay as approved.");
        }
        var item = old?.Value ?? new ServicePlan { Id = op.Id, ParishId = parish, Kind = kind, CreatedBy = actor.AccountId, CreatedAt = op.At };
        item.EventId = occurrence?.Id;
        item.Title = Guard.Text(request.Title, "Title", 300);
        // Arabic twins are stored as typed; one language is never filled from the other.
        item.TitleAr = Optional(request.TitleAr, "Arabic title", 300);
        item.Language = Optional(request.Language, "Language", 10);
        item.PlanType = request.PlanType is "Liturgy" or "Activity" ? request.PlanType : throw new DomainException("invalid_input", "Use Liturgy or Activity.");
        item.CoordinatorAccountId = coordinator;
        // People are event-specific: templates never carry a celebrant or assignees.
        item.CelebrantAccountId = request.CelebrantAccountId is { } celebrant && kind == "Plan" ? Guard.Id(celebrant) : null;
        item.Items = items;
        item.TemplateId = request.TemplateId is { } source ? Guard.Id(source) : item.TemplateId;
        item.Status = "Draft";
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "service_plan.save", item.Id,
            [Fence(root), old is null ? RecordChange.Create(Key(item.Id), "servicePlan", item)
                : RecordChange.Replace(Key(item.Id), "servicePlan", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await ProjectAsync(parish, item, occurrence, ct);
    }

    public async Task<ServicePlanDto> ActAsync(string parish, string id, PlanActionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.ScheduleManage, ct);
        // Review decisions are a priest's; preparation and completion stay with planning staff.
        if (request.Action is "return" or "approve")
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "service-plan-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return (await GetAsync(parish, id, ct)).Value;
        var item = (await ReadAsync(parish, id, ct)).Value;
        var occurrence = item.EventId is null ? null : (await records.ReadAsync<CalendarEvent>(Scope(parish), "event:" + item.EventId, ct))?.Value;
        switch (request.Action)
        {
            case "submit" when item.Status is "Draft" or "Returned":
            case "approve" when item.Status == "ReadyForReview":
                var issues = await IssuesAsync(parish, item, occurrence, ct);
                if (issues.Length > 0)
                    throw new DomainException("plan_has_blocking_issues", "Resolve the plan's blocking issues first: " + string.Join(", ", issues), FailureKind.Conflict);
                if (request.Action == "submit")
                {
                    item.Status = "ReadyForReview";
                    item.ReturnReason = null;
                }
                else
                {
                    item.Status = "Approved";
                    item.ApprovedBy = actor.AccountId;
                    item.ApprovedAt = op.At;
                }
                break;
            case "return" when item.Status == "ReadyForReview":
                item.ReturnReason = Guard.Text(request.Reason, "Return reason", 2000);
                item.Status = "Returned";
                break;
            case "complete" when item.Status == "Approved" && item.Kind == "Plan":
                if (occurrence is null || occurrence.EndsAt > op.At)
                    throw State("A plan is completed after its event has ended.");
                item.Status = "Completed";
                break;
            case "cancel" when item.Status is not ("Completed" or "Cancelled"):
                item.ReturnReason = Guard.Text(request.Reason, "Cancellation reason", 2000);
                item.Status = "Cancelled";
                break;
            default:
                throw State("This plan action is not available in its current state.");
        }
        item.UpdatedBy = actor.AccountId;
        item.UpdatedAt = op.At;
        await records.CommitAsync(Scope(parish), op, "service_plan." + request.Action, item.Id,
            [Fence(root), RecordChange.Replace(Key(item.Id), "servicePlan", item, Versions.Require(request.Version))],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return await ProjectAsync(parish, item, occurrence, ct);
    }

    public async Task<Versioned<ServicePlanDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.ScheduleRead, ct);
        var row = await ReadAsync(parish, id, ct);
        var occurrence = row.Value.EventId is null ? null : (await records.ReadAsync<CalendarEvent>(Scope(parish), "event:" + row.Value.EventId, ct))?.Value;
        return new Versioned<ServicePlanDto> { Version = row.Version, Value = await ProjectAsync(parish, row.Value, occurrence, ct) };
    }

    public async Task<Page<Versioned<ServicePlanDto>>> ListAsync(string parish, string? eventId, int size, string? cursor, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.ScheduleRead, ct);
        var condition = eventId is null
            ? new RecordCondition { Path = "kind", Comparison = "eq", Value = "Template" }
            : new RecordCondition { Path = "eventId", Comparison = "eq", Value = eventId };
        var page = await records.PageAsync<ServicePlan>(Scope(parish), "servicePlan", size, cursor, ct, condition);
        var items = new List<Versioned<ServicePlanDto>>();
        foreach (var row in page.Items)
        {
            var occurrence = row.Value.EventId is null ? null : (await records.ReadAsync<CalendarEvent>(Scope(parish), "event:" + row.Value.EventId, ct))?.Value;
            items.Add(new Versioned<ServicePlanDto> { Version = row.Version, Value = await ProjectAsync(parish, row.Value, occurrence, ct) });
        }
        return new Page<Versioned<ServicePlanDto>> { Items = items, ContinuationToken = page.ContinuationToken };
    }

    // Each audience sees only its own instructions; private instructions, assignees and unpermitted music text stay out.
    public async Task<PlanOutputDto> OutputAsync(string parish, string id, string audience, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.ScheduleRead, ct);
        if (audience is not ("clergy" or "team" or "musicians" or "participants"))
            throw new DomainException("invalid_input", "Use clergy, team, musicians or participants.");
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Kind != "Plan" || item.Status is not ("Approved" or "Completed"))
            throw State("Outputs are produced from an approved plan.");
        var occurrence = (await records.ReadAsync<CalendarEvent>(Scope(parish), "event:" + item.EventId, ct) ?? throw Missing()).Value;
        var output = new List<PlanOutputItemDto>();
        foreach (var (entry, start, end) in Timeline(item.Items, occurrence.StartsAt))
        {
            var music = entry.MusicVersionId is null ? null : (await records.ReadAsync<MusicVersion>(Scope(parish), "music:" + entry.MusicVersionId, ct))?.Value;
            if (audience == "musicians" && music is null)
                continue;
            var visible = audience switch
            {
                "clergy" => true,
                "team" => entry.InstructionAudience is "Team" or "Everyone",
                _ => entry.InstructionAudience == "Everyone"
            };
            var printable = music is { Status: not "Withdrawn", PrintAllowed: true };
            output.Add(new PlanOutputItemDto
            {
                Title = entry.Title, TitleAr = entry.TitleAr, StartsAt = start, EndsAt = end, ResponsibleRole = entry.ResponsibleRole,
                AssignedAccountId = audience is "clergy" or "team" ? entry.AssignedAccountId : null,
                Instructions = visible ? entry.Instructions : null,
                InstructionsAr = visible ? entry.InstructionsAr : null,
                MusicTitle = music?.Status == "Withdrawn" ? null : music?.Title,
                MusicTitleAr = music?.Status == "Withdrawn" ? null : music?.TitleAr,
                MusicText = audience == "musicians" && printable ? string.Join("\n\n", new[] { music!.Lyrics, music.Chords }.Where(x => x is not null)) : null,
                Attribution = printable ? music!.Attribution : null
            });
        }
        return new PlanOutputDto { PlanId = item.Id, Audience = audience, Title = item.Title, TitleAr = item.TitleAr, Items = [.. output] };
    }

    private async Task<ServicePlanItem[]> ItemsAsync(PlanItemDto[]? input, string kind, CancellationToken ct)
    {
        if (input is null || input.Length > 80 || input.Select(x => x.Key).Distinct(StringComparer.Ordinal).Count() != input.Length)
            throw new DomainException("invalid_input", "Use up to 80 items with distinct keys.");
        var result = new List<ServicePlanItem>();
        foreach (var entry in input)
        {
            if (entry.Minutes is < 0 or > 1440 || entry.InstructionAudience is not ("Clergy" or "Team" or "Everyone"))
                throw new DomainException("invalid_input", "Item minutes must be 0–1440 with a supported instruction audience.");
            if (kind == "Template" && (entry.AssignedAccountId is not null || entry.FixedStart is not null))
                throw new DomainException("invalid_input", "Templates carry structure only; people and fixed times are chosen per event.");
            string? assigned = null;
            if (entry.AssignedAccountId is { } account)
            {
                assigned = Guard.Id(account);
                if (!await accounts.IsActiveVerifiedAsync(assigned, ct))
                    throw new DomainException("invalid_input", "Assigned people must be active verified accounts.");
            }
            result.Add(new ServicePlanItem
            {
                Key = Guard.Text(entry.Key, "Item key", 40), Title = Guard.Text(entry.Title, "Item title", 300),
                TitleAr = Optional(entry.TitleAr, "Arabic item title", 300), Minutes = entry.Minutes,
                FixedStart = entry.FixedStart is { } fixedStart ? Guard.Utc(fixedStart) : null,
                ResponsibleRole = string.IsNullOrWhiteSpace(entry.ResponsibleRole) ? null : Guard.Text(entry.ResponsibleRole, "Role", 100),
                Required = entry.Required, AssignedAccountId = assigned,
                Instructions = string.IsNullOrWhiteSpace(entry.Instructions) ? null : Guard.Text(entry.Instructions, "Instructions", 2000),
                InstructionsAr = Optional(entry.InstructionsAr, "Arabic instructions", 2000),
                InstructionAudience = entry.InstructionAudience, MusicVersionId = entry.MusicVersionId is { } music ? Guard.Id(music) : null
            });
        }
        return [.. result];
    }

    private async Task<ServicePlanItem[]> FromTemplateAsync(string parish, string template, CancellationToken ct)
    {
        var source = (await ReadAsync(parish, template, ct)).Value;
        if (source.Kind != "Template" || source.Status != "Approved")
            throw State("Copy from an approved template.");
        // Structure, durations, instructions and music references are copied; people and times are reviewed per event.
        return source.Items.Select(x => new ServicePlanItem
        {
            Key = x.Key, Title = x.Title, TitleAr = x.TitleAr, Minutes = x.Minutes, ResponsibleRole = x.ResponsibleRole, Required = x.Required,
            Instructions = x.Instructions, InstructionsAr = x.InstructionsAr, InstructionAudience = x.InstructionAudience, MusicVersionId = x.MusicVersionId
        }).ToArray();
    }

    private async Task<string[]> IssuesAsync(string parish, ServicePlan item, CalendarEvent? occurrence, CancellationToken ct)
    {
        var issues = new List<string>();
        foreach (var entry in item.Items.Where(x => x.MusicVersionId is not null))
            if ((await records.ReadAsync<MusicVersion>(Scope(parish), "music:" + entry.MusicVersionId, ct))?.Value is not { Status: not "Withdrawn" })
                issues.Add("MusicUnavailable:" + entry.Key);
        if (item.Kind == "Template")
            return [.. issues];
        if (occurrence is null || occurrence.Status == "Cancelled")
            return [.. issues, "EventUnavailable"];
        var cursor = occurrence.StartsAt;
        foreach (var entry in item.Items)
        {
            if (entry.FixedStart is { } fixedStart)
            {
                if (fixedStart < cursor || fixedStart < occurrence.StartsAt)
                    issues.Add("FixedStartConflict:" + entry.Key);
                cursor = fixedStart > cursor ? fixedStart : cursor;
            }
            cursor = cursor.AddMinutes(entry.Minutes);
            if (entry.Required && entry.AssignedAccountId is null)
                issues.Add("UnassignedRole:" + entry.Key);
        }
        if (cursor > occurrence.EndsAt)
            issues.Add("Overtime");
        if (item.PlanType == "Liturgy")
        {
            try
            {
                if (item.CelebrantAccountId is null) issues.Add("CelebrantRequired");
                else await clergy.RequireAsync(parish, item.CelebrantAccountId, "Priest", ct);
            }
            catch (DomainException) { issues.Add("CelebrantRequired"); }
        }
        return [.. issues];
    }

    private static IEnumerable<(ServicePlanItem Item, DateTimeOffset Start, DateTimeOffset End)> Timeline(ServicePlanItem[] items, DateTimeOffset start)
    {
        var cursor = start;
        foreach (var entry in items)
        {
            if (entry.FixedStart is { } fixedStart && fixedStart > cursor)
                cursor = fixedStart;
            yield return (entry, cursor, cursor.AddMinutes(entry.Minutes));
            cursor = cursor.AddMinutes(entry.Minutes);
        }
    }

    // The accounts that could be chosen as a Liturgy's celebrant: current priests of this parish, each re-checked through the same
    // clergy authority the approval uses, so ended, denied or unverified appointments never appear. Names come from the account-names lookup.
    public async Task<IReadOnlyList<PlanCelebrantDto>> CelebrantsAsync(string parish, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.ScheduleManage, ct);
        var now = clock.GetUtcNow();
        var rows = await records.CollectAsync<StaffAppointment>(Scope(parish), "staffAppointment", ct, 500);
        var result = new List<PlanCelebrantDto>();
        foreach (var account in rows.Select(row => row.Value)
            .Where(value => value.ParishId == parish && value.Role == StaffAppointmentRole.Priest && value.IsEffective(now))
            .Select(value => value.AccountId).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal))
        {
            try
            {
                await clergy.RequireAsync(parish, account, "Priest", ct);
                result.Add(new PlanCelebrantDto { AccountId = account });
            }
            catch (DomainException) { }
        }
        return result;
    }

    private static string? Optional(string? value, string field, int max) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, field, max);

    private async Task<Versioned<ServicePlan>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<ServicePlan>(Scope(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private async Task<ServicePlanDto> ProjectAsync(string parish, ServicePlan item, CalendarEvent? occurrence, CancellationToken ct)
    {
        var times = item.Kind == "Plan" && occurrence is not null
            ? Timeline(item.Items, occurrence.StartsAt).ToDictionary(x => x.Item.Key, x => (x.Start, x.End), StringComparer.Ordinal)
            : [];
        return new ServicePlanDto
        {
            Id = item.Id, Kind = item.Kind, EventId = item.EventId, Title = item.Title, TitleAr = item.TitleAr, Language = item.Language, PlanType = item.PlanType,
            CoordinatorAccountId = item.CoordinatorAccountId, CelebrantAccountId = item.CelebrantAccountId, Status = item.Status,
            Items = item.Items.Select(x => new PlanItemDto
            {
                Key = x.Key, Title = x.Title, TitleAr = x.TitleAr, Minutes = x.Minutes, FixedStart = x.FixedStart, ResponsibleRole = x.ResponsibleRole, Required = x.Required,
                AssignedAccountId = x.AssignedAccountId is null ? null : Guid.Parse(x.AssignedAccountId), Instructions = x.Instructions, InstructionsAr = x.InstructionsAr,
                InstructionAudience = x.InstructionAudience, MusicVersionId = x.MusicVersionId is null ? null : Guid.Parse(x.MusicVersionId),
                StartsAt = times.TryGetValue(x.Key, out var at) ? at.Start : null, EndsAt = times.TryGetValue(x.Key, out var until) ? until.End : null
            }).ToArray(),
            Issues = item.Status is "Completed" or "Cancelled" ? [] : await IssuesAsync(parish, item, occurrence, ct),
            TotalMinutes = item.Items.Sum(x => x.Minutes), TemplateId = item.TemplateId, ReturnReason = item.ReturnReason,
            ApprovedBy = item.ApprovedBy, ApprovedAt = item.ApprovedAt, UpdatedAt = item.UpdatedAt
        };
    }
}
