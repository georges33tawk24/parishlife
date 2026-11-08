// Purpose: represents service plan item business state and rules.
// Main members: Id, Order, Title, Minutes, AssignedAccountId, MusicVersionId.

namespace ParishLife.Api.Models;

public class ServicePlanItem
{
    public string Id { get; set; } = string.Empty;

    public int Order { get; set; }

    public string Title { get; set; } = string.Empty;

    public int Minutes { get; set; }

    public string? AssignedAccountId { get; set; }

    public string? MusicVersionId { get; set; }
}
