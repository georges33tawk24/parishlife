// Purpose: states whether one integration or platform capability is actually available and what the system does instead when it is not.
// Main members: Name, Available and Behaviour.

namespace ParishLife.Api.DTOs.Administration;

public class CapabilityDto
{
    public string Name { get; set; } = string.Empty;

    public bool Available { get; set; }

    public string Behaviour { get; set; } = string.Empty;
}
