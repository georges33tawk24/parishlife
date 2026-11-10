// Purpose: identifies an authorized collector to an assigned door operator without disclosing private authority evidence.
// Main members: Id and Name are used with the required real-world identity check at checkout.

namespace ParishLife.Api.DTOs.Registrations;

public class DoorCollectorDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
}
