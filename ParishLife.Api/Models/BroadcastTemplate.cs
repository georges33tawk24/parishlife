// Purpose: reusable parish message wording; a draft becomes usable only after a different staff member approves it.
// Main members: Id, ParishId, Name, Title, Body, Language, optional Arabic version (TitleAr, BodyAr), Status (Draft, Approved, Retired)
// and editor/approver facts.

namespace ParishLife.Api.Models;

public class BroadcastTemplate
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Language { get; set; } = "en";

    public string? TitleAr { get; set; } = null;

    public string? BodyAr { get; set; } = null;

    public string Status { get; set; } = "Draft";

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;
}
