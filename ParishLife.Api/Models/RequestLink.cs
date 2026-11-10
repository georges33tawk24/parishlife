// Purpose: links a request to a downstream operational or official record without replacing its reference.
// Main members: Kind and RecordId.

namespace ParishLife.Api.Models;

public class RequestLink
{
    public string Kind { get; set; } = string.Empty;

    public string RecordId { get; set; } = string.Empty;
}
