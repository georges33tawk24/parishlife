// Purpose: confirms to the recorder that an incident was stored, without granting them read access to it.
// Main members: Id, Status, RecordedAt and Urgent.

namespace ParishLife.Api.DTOs.Care;

public class IncidentReceiptDto
{
    public string Id { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset RecordedAt { get; set; }

    public bool Urgent { get; set; }
}
