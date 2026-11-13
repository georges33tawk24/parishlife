// Purpose: manages a parish's reusable event templates, which prefill manual calendar drafts and never act on events themselves.
// Main functions: SaveAsync (create or versioned edit), ActAsync (archive or restore), GetAsync and ListAsync; Validate applies the
// same manual-kind and audience rules as calendar drafts, so a template can never describe an event a draft could not be.

using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Scheduling;

public class EventTemplateService(IRecordTransactions records, IParishAccess access, ICurrentActor actor, TimeProvider clock)
{
    private static string Key(string id) => "eventTemplate:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested event template is unavailable.", FailureKind.NotFound);

    private async Task<Versioned<Parish>> AuthorizeAsync(string parish, string permission, CancellationToken ct)
    {
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "core", ct);
        return root;
    }

    public async Task<Versioned<EventTemplateDto>> SaveAsync(string parish, string? id, SaveEventTemplateDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.ScheduleManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "event-template:v1:" + (id ?? "new"));
        if (await records.ReplayAsync<CommandResult>(SchedulingScope.For(parish), op, ct) is { } prior)
            return await GetAsync(parish, prior.Id, ct);
        Versioned<EventTemplate>? old = null;
        if (id is not null)
        {
            old = await ReadAsync(parish, id, ct);
            if (old.Value.Status != "Active")
                throw new DomainException("invalid_template_state", "Restore an archived template before changing it.", FailureKind.Conflict);
        }
        var value = old?.Value ?? new EventTemplate { Id = op.Id, ParishId = parish, CreatedBy = actor.AccountId, CreatedAt = op.At };
        Validate(request);
        value.Name = Guard.Text(request.Name, "Name", 500);
        // The Arabic twin is stored as typed; neither language is filled from the other.
        value.NameAr = Optional(request.NameAr, "Arabic name", 500);
        value.Kind = request.Kind;
        value.Visibility = request.Visibility;
        value.StartTime = string.IsNullOrWhiteSpace(request.StartTime) ? null : request.StartTime;
        value.DurationMinutes = request.DurationMinutes;
        value.Description = Optional(request.Description, "Description", 10000);
        value.DescriptionAr = Optional(request.DescriptionAr, "Arabic description", 10000);
        value.UpdatedBy = actor.AccountId;
        value.UpdatedAt = op.At;
        await records.CommitAsync(SchedulingScope.For(parish), op, "calendar.template_save", value.Id,
            [SchedulingScope.Fence(root), old is null ? RecordChange.Create(Key(value.Id), "eventTemplate", value)
                : RecordChange.Replace(Key(value.Id), "eventTemplate", value, Versions.Require(request.Version))],
            new CommandResult { Id = value.Id, Status = value.Status }, ct);
        return await GetAsync(parish, value.Id, ct);
    }

    public async Task<Versioned<EventTemplateDto>> ActAsync(string parish, string id, EventTemplateActionDto request, CancellationToken ct)
    {
        var root = await AuthorizeAsync(parish, Permissions.ScheduleManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "event-template-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(SchedulingScope.For(parish), op, ct) is not null)
            return await GetAsync(parish, id, ct);
        var row = await ReadAsync(parish, id, ct);
        var value = row.Value;
        value.Status = (request.Action, value.Status) switch
        {
            ("archive", "Active") => "Archived",
            ("restore", "Archived") => "Active",
            _ => throw new DomainException("invalid_template_state", "Archive an active template or restore an archived one.", FailureKind.Conflict)
        };
        value.UpdatedBy = actor.AccountId;
        value.UpdatedAt = op.At;
        await records.CommitAsync(SchedulingScope.For(parish), op, "calendar.template_" + request.Action, id,
            [SchedulingScope.Fence(root), RecordChange.Replace(Key(id), "eventTemplate", value, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = value.Status }, ct);
        return await GetAsync(parish, id, ct);
    }

    public async Task<Versioned<EventTemplateDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.ScheduleRead, ct);
        var row = await ReadAsync(parish, id, ct);
        return new Versioned<EventTemplateDto> { Value = Project(row.Value), Version = row.Version };
    }

    public async Task<Page<Versioned<EventTemplateDto>>> ListAsync(string parish, bool includeArchived, int size, string? cursor, CancellationToken ct)
    {
        await AuthorizeAsync(parish, Permissions.ScheduleRead, ct);
        if (size is < 1 or > 100)
            throw new DomainException("invalid_page", "Use 1–100 rows.");
        var filters = includeArchived ? Array.Empty<RecordCondition>()
            : [new RecordCondition { Path = "status", Comparison = "eq", Value = "Active" }];
        var page = await records.PageAsync<EventTemplate>(SchedulingScope.For(parish), "eventTemplate", size, cursor, ct, filters);
        return new Page<Versioned<EventTemplateDto>>
        {
            Items = page.Items.Where(row => row.Value.ParishId == parish)
                .Select(row => new Versioned<EventTemplateDto> { Value = Project(row.Value), Version = row.Version }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    private static void Validate(SaveEventTemplateDto request)
    {
        if (request.Kind is not ("ParishActivity" or "Appointment" or "ResourceBlock"))
            throw new DomainException("source_command_required", "Templates support the manual kinds ParishActivity, Appointment and ResourceBlock.");
        if (request.Visibility is not ("Public" or "Parish" or "Private") || request.Kind is "Appointment" or "ResourceBlock" && request.Visibility != "Private")
            throw new DomainException("invalid_visibility", "Choose an explicit supported audience; appointments and resource blocks remain private.");
        if (request.DurationMinutes is < 1 or > 44640)
            throw new DomainException("invalid_input", "Use a length of 1 minute to 31 days.");
        if (!string.IsNullOrWhiteSpace(request.StartTime) && !TimeOnly.TryParseExact(request.StartTime, "HH:mm", out _))
            throw new DomainException("invalid_input", "Use a 24-hour start time such as 10:30.");
    }

    private static string? Optional(string? value, string field, int max) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, field, max);

    private async Task<Versioned<EventTemplate>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<EventTemplate>(SchedulingScope.For(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static EventTemplateDto Project(EventTemplate value) => new()
    {
        Id = value.Id, ParishId = value.ParishId, Name = value.Name, NameAr = value.NameAr, Kind = value.Kind, Visibility = value.Visibility,
        StartTime = value.StartTime, DurationMinutes = value.DurationMinutes, Description = value.Description, DescriptionAr = value.DescriptionAr,
        Status = value.Status, CreatedBy = value.CreatedBy, UpdatedBy = value.UpdatedBy, UpdatedAt = value.UpdatedAt
    };
}
