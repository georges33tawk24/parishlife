// Purpose: shared custom-workflow access, storage keys and template mapping for the definition and run services.
// Main functions: RequireMfaAsync, RequireModuleAsync, RequireAsync (current MFA + exact parish permission in the selected capacity + paid office module), HoldsAsync (non-throwing
// permission probe), RequireAnyAsync, DefinitionAsync, VersionAsync, Fence, ToModel/ToDto. Recovery sessions fail the MFA check.

using ParishLife.Api.DTOs.Workflows;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Workflows;

public class WorkflowAccess(IRecordTransactions records, IParishAccess access, MfaAccountAccess proof)
{
    internal static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    internal static string DefinitionKey(string id) => "workflowDefinition:" + id;
    internal static string VersionKey(string id) => "workflowVersion:" + id;
    internal static DomainException Missing() => new("resource_not_found", "The requested workflow resource is unavailable.", FailureKind.NotFound);
    internal static DomainException Conflict(string code, string message) => new(code, message, FailureKind.Conflict);
    internal static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);
    internal static RecordChange Fence(Versioned<WorkflowDefinition> row) => RecordChange.Replace(DefinitionKey(row.Value.Id), "workflowDefinition", row.Value, row.Version);

    internal async Task<Versioned<Parish>> RequireAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    internal Task RequireMfaAsync(CancellationToken ct) => proof.RequireMfaAsync(ct);

    internal Task RequireModuleAsync(string parish, CancellationToken ct) => access.RequireModuleAsync(parish, "office", ct);

    // Probes one permission without throwing for an absent grant; callers must already have required MFA.
    internal async Task<bool> HoldsAsync(string parish, string permission, CancellationToken ct)
    {
        try { await access.RequireAsync(parish, permission, ct); return true; }
        catch (DomainException error) when (error.Kind == FailureKind.NotFound) { return false; }
    }

    // Returns the subset of the given permissions the actor currently holds; throws not-found when none is held.
    internal async Task<HashSet<string>> RequireAnyAsync(string parish, IEnumerable<string> permissions, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var held = new HashSet<string>(StringComparer.Ordinal);
        foreach (var permission in permissions.Distinct(StringComparer.Ordinal))
            if (await HoldsAsync(parish, permission, ct)) held.Add(permission);
        if (held.Count == 0) throw Missing();
        await access.RequireModuleAsync(parish, "office", ct);
        return held;
    }

    internal async Task<Versioned<WorkflowDefinition>> DefinitionAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<WorkflowDefinition>(Scope(parish), DefinitionKey(id), ct) is { } row && row.Value.Id == id && row.Value.ParishId == parish ? row : throw Missing();

    internal async Task<WorkflowVersion> VersionAsync(string parish, string definition, string id, CancellationToken ct)
        => await records.ReadAsync<WorkflowVersion>(Scope(parish), VersionKey(id), ct) is { } row && row.Value.Id == id && row.Value.ParishId == parish
            && row.Value.DefinitionId == definition ? row.Value : throw Missing();

    internal static WorkflowTemplate? ToModel(WorkflowTemplateDto? dto) => dto is null ? null : new WorkflowTemplate
    {
        StartPermission = dto.StartPermission, Fields = dto.Fields, RestrictedFieldKeys = dto.RestrictedFieldKeys,
        Steps = dto.Steps?.Select(s => s is null ? null! : new WorkflowStep
        {
            Key = s.Key, Title = s.Title?.Trim() ?? "", Permission = s.Permission, WhenField = s.WhenField, WhenValue = s.WhenValue, ViewsRestricted = s.ViewsRestricted
        }).ToArray()!
    };

    internal static WorkflowTemplateDto ToDto(WorkflowTemplate x) => new()
    {
        StartPermission = x.StartPermission, Fields = x.Fields, RestrictedFieldKeys = [.. x.RestrictedFieldKeys],
        Steps = x.Steps.Select(s => new WorkflowStepDto
        {
            Key = s.Key, Title = s.Title, Permission = s.Permission, WhenField = s.WhenField, WhenValue = s.WhenValue, ViewsRestricted = s.ViewsRestricted
        }).ToArray()
    };
}
