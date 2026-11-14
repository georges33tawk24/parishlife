// Purpose: a change to an accepted sacrament request (requested date or case facts) proposed by the office and decided by a priest;
// the request stays unchanged until a priest approves, and every proposal and decision is kept.
// Main members: Id, TentativeDate, Facts (changed keys; an empty value removes the key), previous values, Reason, Status and decision facts.

namespace ParishLife.Api.Models;

public class SacramentRequestAmendment
{
    public string Id { get; set; } = string.Empty;

    public string? TentativeDate { get; set; } = null;

    public Dictionary<string, string> Facts { get; set; } = new();

    public string? PreviousTentativeDate { get; set; } = null;

    public Dictionary<string, string> PreviousFacts { get; set; } = new();

    public string Reason { get; set; } = string.Empty;

    // Pending, Approved or Rejected.
    public string Status { get; set; } = "Pending";

    public string ProposedBy { get; set; } = string.Empty;

    public DateTimeOffset ProposedAt { get; set; }

    public string? DecidedBy { get; set; } = null;

    public DateTimeOffset? DecidedAt { get; set; } = null;

    public string? DecisionNote { get; set; } = null;
}
