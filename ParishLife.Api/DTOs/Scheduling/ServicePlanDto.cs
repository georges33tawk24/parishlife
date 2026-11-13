// Purpose: returns a plan or template with its computed timeline and blocking issues.
// Main members: Id, Kind, EventId, Title, PlanType, coordinator/celebrant, Status, Items, Issues, TotalMinutes, template source and review facts; optional TitleAr (Arabic twin) and Language.

namespace ParishLife.Api.DTOs.Scheduling;

public class ServicePlanDto
{
    public string Id { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string? EventId { get; set; } = null;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public string? Language { get; set; } = null;

    public string PlanType { get; set; } = string.Empty;

    public string CoordinatorAccountId { get; set; } = string.Empty;

    public string? CelebrantAccountId { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public PlanItemDto[] Items { get; set; } = Array.Empty<PlanItemDto>();

    // Blocking issues; review and approval need none.
    public string[] Issues { get; set; } = Array.Empty<string>();

    public int TotalMinutes { get; set; }

    public string? TemplateId { get; set; } = null;

    public string? ReturnReason { get; set; } = null;

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    public DateTimeOffset UpdatedAt { get; set; }
}
