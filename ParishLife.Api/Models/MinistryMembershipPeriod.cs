// Purpose: preserves one actual ministry membership interval independently of the person's later departures and rejoins.
// Main members: Id, MinistryId, PersonId, JoinedAt, LeftAt, the actual approving application/actor references and RemovalId for a priest's roster removal.

namespace ParishLife.Api.Models;

public class MinistryMembershipPeriod
{
    public string Id { get; set; } = string.Empty;
    public string MinistryId { get; set; } = string.Empty;
    public string PersonId { get; set; } = string.Empty;
    public DateTimeOffset JoinedAt { get; set; }
    public DateTimeOffset? LeftAt { get; set; }
    public string JoinApplicationId { get; set; } = string.Empty;
    public string? LeaveApplicationId { get; set; }
    public string ApprovedBy { get; set; } = string.Empty;
    public string? EndedBy { get; set; }
    public string? RemovalId { get; set; }
}
