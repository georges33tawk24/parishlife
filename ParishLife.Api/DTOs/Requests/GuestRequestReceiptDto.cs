// Purpose: returns a guest request reference and its private tracking token once; the token is not stored.
// Main members: Reference, RequestId and TrackingToken.

namespace ParishLife.Api.DTOs.Requests;

public class GuestRequestReceiptDto
{
    public string Reference { get; set; } = string.Empty;

    public string RequestId { get; set; } = string.Empty;

    public string TrackingToken { get; set; } = string.Empty;
}
