// Purpose: records the account's chosen primary parish for personal defaults only.
// Main members: ParishId and ChosenAt.

namespace ParishLife.Api.Models;

public class PrimaryParish
{
    public string ParishId { get; set; } = string.Empty;

    public DateTimeOffset ChosenAt { get; set; }
}
