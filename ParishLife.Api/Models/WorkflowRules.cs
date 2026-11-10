// Purpose: shared custom-workflow rules: definition modes, run statuses and template validation before a draft is saved or published.
// Main functions: Modes, ValidateTemplate (known start/step permissions, valid shared form fields, existing restricted fields, distinct step keys,
// reachable step conditions, at least one unconditional step) and Applies (a conditional branch evaluated from pinned answers).

namespace ParishLife.Api.Models;

public static class WorkflowRules
{
    // Open: new runs allowed. PausedNew: no new runs, existing runs continue. SafetyStop: no new runs and no run may advance or reopen.
    public static readonly string[] Modes = ["Open", "PausedNew", "SafetyStop"];
    public const int MaximumSteps = 20;

    public static void ValidateTemplate(WorkflowTemplate? template)
    {
        if (template?.Fields is null || template.Steps is null || template.RestrictedFieldKeys is null)
            throw new DomainException("invalid_workflow", "A workflow needs a start permission, field, restricted-field and step lists.");
        if (!Permissions.All.Contains(template.StartPermission ?? ""))
            throw new DomainException("invalid_workflow_permission", "Use an existing parish permission for who may start this workflow.");
        RegistrationRules.ValidateFields(template.Fields);
        var fields = template.Fields.ToDictionary(f => f.Key, StringComparer.Ordinal);
        if (template.RestrictedFieldKeys.Distinct(StringComparer.Ordinal).Count() != template.RestrictedFieldKeys.Length
            || template.RestrictedFieldKeys.Any(k => k is null || !fields.ContainsKey(k)))
            throw new DomainException("invalid_restricted_fields", "Restricted fields must be distinct keys of this form.");
        if (template.Steps.Length is < 1 or > MaximumSteps)
            throw new DomainException("invalid_workflow_steps", "A workflow needs between 1 and 20 ordered steps.");
        var keys = new HashSet<string>(StringComparer.Ordinal);
        foreach (var step in template.Steps)
        {
            if (step?.Key is null || step.Key.Length is < 1 or > 60 || step.Key.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '_') || !keys.Add(step.Key))
                throw new DomainException("invalid_workflow_steps", "Use distinct alphanumeric step keys.");
            Guard.Text(step.Title, "Step title", 200);
            // A step only requires an authority the actor already holds; the builder can never grant or replace one.
            if (!Permissions.All.Contains(step.Permission ?? ""))
                throw new DomainException("invalid_workflow_permission", "Each step must require an existing parish permission.");
            if (step.WhenField is not null || step.WhenValue is not null)
                RegistrationRules.ValidateCondition(fields, step.WhenField, step.WhenValue);
        }
        if (template.Steps.All(s => s.WhenField is not null))
            throw new DomainException("invalid_workflow_steps", "At least one step must apply to every run so each run has an accountable actor.");
    }

    public static bool Applies(WorkflowStep step, IReadOnlyDictionary<string, string> answers) => RegistrationRules.Applies(answers, step.WhenField, step.WhenValue);
}
