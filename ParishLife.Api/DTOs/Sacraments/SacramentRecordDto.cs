// Purpose: returns a sacramental case with original facts, current (amended) facts, official registration, amendments and timeline.
// Main members: Id, Sacrament, SubjectPersonId, RequestId, Facts, CurrentFacts, Status, dates, celebrant/celebration facts, OfficialNumber, BookReference, Amendments and Timeline.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Sacraments;

public class SacramentRecordDto
{
    public string Id { get; set; } = string.Empty;

    public string Sacrament { get; set; } = string.Empty;

    public string SubjectPersonId { get; set; } = string.Empty;

    public string? RequestId { get; set; } = null;

    public Dictionary<string, string> Facts { get; set; } = new();

    // Facts with approved amendments applied; the originals stay in Facts.
    public Dictionary<string, string> CurrentFacts { get; set; } = new();

    public string Status { get; set; } = string.Empty;

    public string? TentativeDate { get; set; } = null;

    public DateTimeOffset? ScheduledAt { get; set; } = null;

    public string? CelebrantAccountId { get; set; } = null;

    public string? CelebrantName { get; set; } = null;

    public DateTimeOffset? CelebratedAt { get; set; } = null;

    public string? Place { get; set; } = null;

    public string? Witnesses { get; set; } = null;

    public string? ReturnReason { get; set; } = null;

    public string? OfficialNumber { get; set; } = null;

    public string? BookReference { get; set; } = null;

    public string? RegisteredBy { get; set; } = null;

    public DateTimeOffset? RegisteredAt { get; set; } = null;

    public SacramentAmendment[] Amendments { get; set; } = Array.Empty<SacramentAmendment>();

    public SacramentStep[] Timeline { get; set; } = Array.Empty<SacramentStep>();
}
