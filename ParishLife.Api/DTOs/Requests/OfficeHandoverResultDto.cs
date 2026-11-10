// Purpose: reports how many open cases a handover moved and how many still need another run.
// Main members: Moved and Remaining.

namespace ParishLife.Api.DTOs.Requests;

public class OfficeHandoverResultDto
{
    public int Moved { get; set; }

    public int Remaining { get; set; }
}
