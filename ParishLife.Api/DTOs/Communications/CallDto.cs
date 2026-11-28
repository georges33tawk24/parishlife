// Purpose: returns a placed call: its id and whether the other person had the portal open (it rings only there).
// Main members: Id and Ringing.

namespace ParishLife.Api.DTOs.Communications;

public class CallDto
{
    public string Id { get; set; } = string.Empty;

    public bool Ringing { get; set; }
}
