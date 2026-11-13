// Purpose: returns an audience-specific running sheet, duty list, setlist or participant program for an approved plan.
// Main members: PlanId, Audience, Title and Items; optional Arabic twin TitleAr.

namespace ParishLife.Api.DTOs.Scheduling;

public class PlanOutputDto
{
    public string PlanId { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string? TitleAr { get; set; } = null;

    public PlanOutputItemDto[] Items { get; set; } = Array.Empty<PlanOutputItemDto>();
}
