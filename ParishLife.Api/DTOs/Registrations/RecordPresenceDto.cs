// Purpose: represents record presence input/output data.
// Main members: OperationId, Version, Action, OccurredAt, CollectorId, VerificationEvidence, PaperReason and PickupCode (a secret: the service
// removes it before building the operation fingerprint and never stores it).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class RecordPresenceDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Action { get; set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; set; }

    [StringLength(500)]
    public string? CollectorId { get; set; } = null;

    [StringLength(500)]
    public string? VerificationEvidence { get; set; } = null;

    [StringLength(500)]
    public string? PaperReason { get; set; } = null;

    [StringLength(32)]
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? PickupCode { get; set; } = null;
}
