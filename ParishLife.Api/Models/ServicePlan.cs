// Purpose: represents service plan business state and rules.
// Main members: Id, ParishId, EventId, Title, Status, Items, CreatedBy.

namespace ParishLife.Api.Models;

public class ServicePlan
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public ServicePlanItem[] Items { get; set; } = Array.Empty<ServicePlanItem>();

    public string CreatedBy { get; set; } = string.Empty;
}
