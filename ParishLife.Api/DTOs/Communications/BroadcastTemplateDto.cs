// Purpose: shows a broadcast template to communications staff.
// Main members: Id, Name, Title, Body, Language, Status, UpdatedBy, UpdatedAt, ApprovedBy and ApprovedAt.

namespace ParishLife.Api.DTOs.Communications;

public class BroadcastTemplateDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Language { get; set; } = "en";

    public string Status { get; set; } = "Draft";

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;
}
