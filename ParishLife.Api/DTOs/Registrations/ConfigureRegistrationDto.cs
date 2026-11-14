// Purpose: represents configure registration input/output data.
// Main members: OperationId, Capacity, TransportCapacity, Fee, Currency, Precision, WaitlistAllowed, ages, consent, door operators, Fields and the optional
// ClosesAt, Discounts, Instalments, PaymentMethods and MusterPoint/MusterPointAr (omitted from JSON when null so older request fingerprints stay identical).

using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class ConfigureRegistrationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    public int Capacity { get; set; }

    public int TransportCapacity { get; set; }

    public decimal Fee { get; set; }

    [Required]
    [StringLength(500)]
    public string Currency { get; set; } = string.Empty;

    public int Precision { get; set; }

    public bool WaitlistAllowed { get; set; }

    public int? MinimumAge { get; set; }

    public int? MaximumAge { get; set; }

    public int ChildAgeThreshold { get; set; }

    public bool ConsentRequired { get; set; }

    [Required]
    [StringLength(10000)]
    public string ConsentText { get; set; } = string.Empty;
    [Required]
    public Guid[] DoorAccountIds { get; set; } = Array.Empty<Guid>();
    [Required]
    public RegistrationField[] Fields { get; set; } = Array.Empty<RegistrationField>();

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public DateTimeOffset? ClosesAt { get; set; } = null;

    [MaxLength(20)]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RegistrationDiscount[]? Discounts { get; set; } = null;

    [MaxLength(12)]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public RegistrationInstalment[]? Instalments { get; set; } = null;

    [MaxLength(5)]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string[]? PaymentMethods { get; set; } = null;

    [StringLength(300)]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? MusterPoint { get; set; } = null;

    [StringLength(300)]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? MusterPointAr { get; set; } = null;
}
