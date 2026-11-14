// Purpose: an evacuation roll call for one event with its muster point, counts and entries, plus an explicit coverage note.
// Main members: Id, EventId, Kind, Status, StartedAt/By, ClosedAt/By, Note, MusterPoint, MusterPointAr, Total, Accounted, Entries and Coverage.

namespace ParishLife.Api.DTOs.Registrations;

public class EvacuationDto
{
    public string Id { get; set; } = string.Empty;

    public string EventId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset StartedAt { get; set; }

    public string StartedBy { get; set; } = string.Empty;

    public DateTimeOffset? ClosedAt { get; set; } = null;

    public string? ClosedBy { get; set; } = null;

    public string? Note { get; set; } = null;

    public string? MusterPoint { get; set; } = null;

    public string? MusterPointAr { get; set; } = null;

    public int Total { get; set; }

    public int Accounted { get; set; }

    public EvacuationEntryDto[] Entries { get; set; } = Array.Empty<EvacuationEntryDto>();

    public string Coverage { get; set; } = string.Empty;
}
