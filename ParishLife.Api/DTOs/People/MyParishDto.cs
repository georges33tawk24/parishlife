// Purpose: returns one parish in the caller's combined list, labelled Following or Member, with the primary choice.
// Main members: ParishId, Name, Relationship and Primary.

namespace ParishLife.Api.DTOs.People;

public class MyParishDto
{
    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    // Following or Member; following never implies membership.
    public string Relationship { get; set; } = string.Empty;

    public bool Primary { get; set; }
}
