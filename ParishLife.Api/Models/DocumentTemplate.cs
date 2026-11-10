// Purpose: an authority-supplied certificate wording for one sacrament and language, with {{placeholders}} filled from the certificate snapshot;
// it is used only once the bishop has approved it. The system never writes or translates the wording itself.
// Main members: Kind, Language, ParishId, Body, Status, ProposedBy, ProposedAt, ApprovedBy and ApprovedAt.

namespace ParishLife.Api.Models;

public class DocumentTemplate
{
    public string Kind { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;

    // Proposed or Approved.
    public string Status { get; set; } = "Proposed";

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string? ApprovedBy { get; set; }

    public DateTimeOffset? ApprovedAt { get; set; }
}
