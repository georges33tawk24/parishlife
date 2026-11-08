// Purpose: identifies one complete document transaction area and owner partition.
// Main members: Area, OwnerId.

using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Models;

public class RecordScope
{
    public RecordArea Area { get; set; }

    public string OwnerId { get; set; } = string.Empty;
}
