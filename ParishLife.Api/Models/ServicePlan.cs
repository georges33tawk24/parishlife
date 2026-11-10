// Purpose: represents a service/activity plan for one calendar event, or a reusable template without an event.
// Main members: Id, ParishId, Kind, EventId, Title, PlanType, CoordinatorAccountId, CelebrantAccountId, Status, Items, template source, review and audit facts.

namespace ParishLife.Api.Models;

public class ServicePlan
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // Plan or Template.
    public string Kind { get; set; } = "Plan";

    public string? EventId { get; set; } = null;

    public string Title { get; set; } = string.Empty;

    // Liturgy or Activity; a Liturgy needs a current priest as celebrant.
    public string PlanType { get; set; } = string.Empty;

    public string CoordinatorAccountId { get; set; } = string.Empty;

    public string? CelebrantAccountId { get; set; } = null;

    // Draft, ReadyForReview, Returned, Approved, Completed or Cancelled.
    public string Status { get; set; } = "Draft";

    public ServicePlanItem[] Items { get; set; } = Array.Empty<ServicePlanItem>();

    public string? TemplateId { get; set; } = null;

    public string? ReturnReason { get; set; } = null;

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
