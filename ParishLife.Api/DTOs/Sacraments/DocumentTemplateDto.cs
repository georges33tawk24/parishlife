// Purpose: shows a certificate template and its approval.
// Main members: Kind, Language, Body, Status, ProposedBy, ProposedAt, ApprovedBy and ApprovedAt.

namespace ParishLife.Api.DTOs.Sacraments;

public class DocumentTemplateDto
{
    public string Kind { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string? ApprovedBy { get; set; }

    public DateTimeOffset? ApprovedAt { get; set; }
}
