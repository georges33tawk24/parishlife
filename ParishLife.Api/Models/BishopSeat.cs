// Purpose: reserves the first bishop seat atomically inside one archdiocese partition.
// Main member: AppointmentId points to the retained appointment history; future succession must use a distinct reviewed workflow.

namespace ParishLife.Api.Models;

public class BishopSeat
{
    public string AppointmentId { get; set; } = string.Empty;
}
