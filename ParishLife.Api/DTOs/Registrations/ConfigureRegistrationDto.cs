// Purpose: represents configure registration input/output data.
// Main members: OperationId, Capacity, TransportCapacity, Fee, Currency, Precision, WaitlistAllowed, and related workflow details.

using System.ComponentModel.DataAnnotations;
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
}
