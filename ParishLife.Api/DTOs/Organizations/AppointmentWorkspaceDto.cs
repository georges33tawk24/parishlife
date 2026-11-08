// Purpose: returns one explicit acting appointment and its scoped organization metadata.
// Main members: Appointment, OrganizationName, Capabilities, HasCurrentHead and HasHeadReservation; head observations do not declare an official vacancy.

namespace ParishLife.Api.DTOs.Organizations;

public class AppointmentWorkspaceDto
{

    public StaffAppointmentDto Appointment { get; set; } = new();

    public string OrganizationName { get; set; } = string.Empty;

    public string[] Capabilities { get; set; } = Array.Empty<string>();

    public bool? HasCurrentHead { get; set; }

    public bool? HasHeadReservation { get; set; }
}
