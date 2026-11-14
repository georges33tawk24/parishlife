// Purpose: edits the terms of an existing event registration policy (versioned); questions change through a new form version instead.
// Main members: OperationId, Version, Capacity, TransportCapacity, Fee, Currency, Precision, WaitlistAllowed, ages, ChildAgeThreshold,
// consent, DoorAccountIds, ClosesAt, Discounts, Instalments, PaymentMethods, MusterPoint, MusterPointAr and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class ReviseRegistrationTermsDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public int Capacity { get; set; }

    public int TransportCapacity { get; set; }

    public decimal Fee { get; set; }

    [Required]
    [StringLength(3)]
    public string Currency { get; set; } = string.Empty;

    public int Precision { get; set; }

    public bool WaitlistAllowed { get; set; }

    public int? MinimumAge { get; set; } = null;

    public int? MaximumAge { get; set; } = null;

    public int ChildAgeThreshold { get; set; }

    public bool ConsentRequired { get; set; }

    [StringLength(10000)]
    public string ConsentText { get; set; } = string.Empty;

    [Required]
    [MaxLength(40)]
    public Guid[] DoorAccountIds { get; set; } = Array.Empty<Guid>();

    public DateTimeOffset? ClosesAt { get; set; } = null;

    [MaxLength(20)]
    public RegistrationDiscount[] Discounts { get; set; } = Array.Empty<RegistrationDiscount>();

    [MaxLength(12)]
    public RegistrationInstalment[] Instalments { get; set; } = Array.Empty<RegistrationInstalment>();

    [MaxLength(5)]
    public string[] PaymentMethods { get; set; } = Array.Empty<string>();

    [StringLength(300)]
    public string? MusterPoint { get; set; } = null;

    [StringLength(300)]
    public string? MusterPointAr { get; set; } = null;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
