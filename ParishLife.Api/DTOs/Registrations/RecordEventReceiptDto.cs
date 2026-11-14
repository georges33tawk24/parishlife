// Purpose: represents record event receipt input/output data.
// Main members: OperationId, Version, Amount, Currency, EvidenceReference, OccurredAt and Method (omitted means Cash; omitted from JSON when null
// so older request fingerprints stay identical).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class RecordEventReceiptDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    [Required]
    [StringLength(500)]
    public string Currency { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;

    public DateTimeOffset OccurredAt { get; set; }

    [StringLength(20)]
    [System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    public string? Method { get; set; } = null;
}
