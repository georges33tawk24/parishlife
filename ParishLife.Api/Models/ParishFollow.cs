// Purpose: records that an account follows a parish; following is a personal preference and never membership.
// Main members: ParishId and FollowedAt.

namespace ParishLife.Api.Models;

public class ParishFollow
{
    public string ParishId { get; set; } = string.Empty;

    public DateTimeOffset FollowedAt { get; set; }
}
