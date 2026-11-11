// Purpose: one liturgical calendar version supplied by the competent authority of an archdiocese: rite, year, source and version label with its
// dated entries. Only the current bishop prepares and approves it; approved versions are immutable and are corrected by a reviewed new version that
// supersedes them. Nothing here is computed or derived from sample data.
// Main members: Id, ArchdioceseId, Rite, Year, Source, VersionLabel, ValidFrom/ValidTo, AllowsParishExceptions, Entries, Status
// (Draft, Approved, Superseded, Withdrawn), correction links and preparation/approval/withdrawal history.

namespace ParishLife.Api.Models;

public class LiturgicalCalendar
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

    public List<LiturgicalEntry> Entries { get; set; } = [];

    public string Status { get; set; } = "Draft";

    public string? CorrectsCalendarId { get; set; } = null;

    public string? CorrectionReason { get; set; } = null;

    public string? SupersededBy { get; set; } = null;

    public string PreparedBy { get; set; } = string.Empty;

    public DateTimeOffset PreparedAt { get; set; }

    public string? ApprovedBy { get; set; } = null;

    public string? ApprovalAppointmentId { get; set; } = null;

    public DateTimeOffset? ApprovedAt { get; set; } = null;

    public string? ApprovalNote { get; set; } = null;

    public string? WithdrawnBy { get; set; } = null;

    public DateTimeOffset? WithdrawnAt { get; set; } = null;

    public string? WithdrawnReason { get; set; } = null;
}
