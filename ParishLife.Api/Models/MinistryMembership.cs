// Purpose: represents ministry membership business state and rules.
// Main functions: Current; PeriodId links the current roster projection to its retained actual membership interval.

namespace ParishLife.Api.Models;

public class MinistryMembership
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public DateTimeOffset JoinedAt { get; set; }

    public DateTimeOffset? LeftAt { get; set; }

    public string ApprovedBy { get; set; } = string.Empty;

    public string PeriodId { get; set; } = string.Empty;

    public string ApplicationId { get; set; } = string.Empty;

    public bool Current(DateTimeOffset now) => JoinedAt <= now && (LeftAt is null || now < LeftAt);
}
