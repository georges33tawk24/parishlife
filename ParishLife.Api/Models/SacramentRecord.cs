// Purpose: represents one person's sacramental case from priest acceptance through actual celebration to official registration.
// Main members: Id, ParishId, Kind (sacrament), PersonId, RequestId, Facts, Status, dates, celebrant, celebration facts, official number, amendments and timeline.

namespace ParishLife.Api.Models;

public class SacramentRecord
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    // The sacrament (Baptism, FirstCommunion, Confirmation, Marriage, Funeral, Anointing or Other); named Kind to use the reviewed index path.
    public string Kind { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string? RequestId { get; set; } = null;

    // Rite-specific facts as supplied; approved field templates are a clergy input.
    public Dictionary<string, string> Facts { get; set; } = new();

    // Received, Preparation, Scheduled, Celebrated, Registered, Declined or Cancelled.
    public string Status { get; set; } = "Received";

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

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
