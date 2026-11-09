// Purpose: requests an optional confidential RSVP reason or an explicit versioned clear without changing the planning reply.
// Main members: OperationId, Version, Reason and Clear; the service validates mutually exclusive set/clear intent.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SaveRsvpReasonDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; }

    [StringLength(2000)]
    public string? Reason { get; set; }

    public bool Clear { get; set; }
}
