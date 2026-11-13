// Purpose: applies one of the policy's named discounts to a registration, or removes the applied discount (DiscountKey null), with a reason.
// Main members: OperationId, Version, DiscountKey and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class ApplyRegistrationDiscountDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [StringLength(60)]
    public string? DiscountKey { get; set; } = null;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
