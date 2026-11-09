// Purpose: exposes a neutral membership interval without private departure/application or decision metadata.
// Main members: ministry/person identity, joined/left instants and effective current state.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryMembershipDto
{
    public string MinistryId { get; set; } = string.Empty;
    public string PersonId { get; set; } = string.Empty;
    public DateTimeOffset JoinedAt { get; set; }
    public DateTimeOffset? LeftAt { get; set; }
    public bool Current { get; set; }
}
