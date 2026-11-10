// Purpose: returns a concern to its submitter or a selected reviewer; reviewer identity and anonymous submitters stay hidden.
// Main members: Id, Category, Urgency, Summary, Details, Anonymous, SubmitterAccountId, Status, AssignedToMe, NextAction, CreatedAt and UpdatedAt.

namespace ParishLife.Api.DTOs.Care;

public class ConcernDto
{
    public string Id { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public string Urgency { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string Details { get; set; } = string.Empty;

    public bool Anonymous { get; set; }

    public string? SubmitterAccountId { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public bool AssignedToMe { get; set; }

    public string? NextAction { get; set; } = null;

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
