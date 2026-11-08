// Purpose: defines the supported StaffAppointmentAction values without conflating technical and clergy authority.
// Main members: Suspend, Resume, Revoke, Review.

namespace ParishLife.Api.Models.Enums;

public enum StaffAppointmentAction
{
    Suspend = 1,
    Resume = 2,
    Revoke = 3,
    Review = 4
}
