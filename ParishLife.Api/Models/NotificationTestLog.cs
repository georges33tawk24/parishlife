// Purpose: counts an account's "Send a test notification" presses, so tests stay rare (one a minute, five a day).
// Main members: Day (UTC date of the count), Count and LastAt. Holds no addresses, devices or results. Stored in the account partition.

namespace ParishLife.Api.Models;

public class NotificationTestLog
{
    public DateOnly Day { get; set; }

    public int Count { get; set; }

    public DateTimeOffset LastAt { get; set; }
}
