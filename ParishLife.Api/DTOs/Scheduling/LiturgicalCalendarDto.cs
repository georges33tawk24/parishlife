// Purpose: the bishop's view of one liturgical calendar version with its entries, status and approval/correction history.
// Main members: Id, ArchdioceseId, Rite, Year, Source, VersionLabel, ValidFrom/ValidTo, AllowsParishExceptions, Status, Entries,
// CorrectsCalendarId, CorrectionReason, SupersededBy, PreparedBy/At, ApprovedBy/At, ApprovalNote and WithdrawnReason.

namespace ParishLife.Api.DTOs.Scheduling;

public class LiturgicalCalendarDto
{
    public string Id { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string Rite { get; set; } = string.Empty;

    public int Year { get; set; }

    public string Source { get; set; } = string.Empty;

    public string VersionLabel { get; set; } = string.Empty;

    public DateOnly ValidFrom { get; set; }

    public DateOnly ValidTo { get; set; }

    public bool AllowsParishExceptions { get; set; }

    public string Status { get; set; } = string.Empty;

    public LiturgicalEntryDto[] Entries { get; set; } = Array.Empty<LiturgicalEntryDto>();

    public string? CorrectsCalendarId { get; set; } = null;

    public string? CorrectionReason { get; set; } = null;

    public string? SupersededBy { get; set; } = null;

    public string PreparedBy { get; set; } = string.Empty;

    public DateTimeOffset PreparedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    public string? ApprovalNote { get; set; } = null;

    public string? WithdrawnReason { get; set; } = null;
}
