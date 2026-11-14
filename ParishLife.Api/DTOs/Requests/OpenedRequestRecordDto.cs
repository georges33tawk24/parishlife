// Purpose: returns the downstream record opened for a request case and whether the case now links it.
// Main members: RecordKind, RecordId, RecordStatus, LinkKind and Linked.

namespace ParishLife.Api.DTOs.Requests;

public class OpenedRequestRecordDto
{
    public string RecordKind { get; set; } = string.Empty;

    public string RecordId { get; set; } = string.Empty;

    public string RecordStatus { get; set; } = string.Empty;

    // The request link kind: SacramentRecord or Certificate.
    public string LinkKind { get; set; } = string.Empty;

    public bool Linked { get; set; }
}
