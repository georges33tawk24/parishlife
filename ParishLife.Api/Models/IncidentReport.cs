// Purpose: the initial incident report facts, serialized and protected together inside Incident.ProtectedReport.
// Main members: Description, ImmediateActions and Witnesses.

namespace ParishLife.Api.Models;

public class IncidentReport
{
    public string Description { get; set; } = string.Empty;

    public string? ImmediateActions { get; set; }

    public string? Witnesses { get; set; }
}
