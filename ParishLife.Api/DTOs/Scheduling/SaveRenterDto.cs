// Purpose: records an external renter.
// Main members: OperationId, Name, NameAr, Organization, OrganizationAr, ResponsibleContact and VerificationReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveRenterDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(200)]
    public string? NameAr { get; set; } = null;

    [StringLength(200)]
    public string? Organization { get; set; } = null;

    [StringLength(200)]
    public string? OrganizationAr { get; set; } = null;

    [Required]
    [StringLength(320)]
    public string ResponsibleContact { get; set; } = string.Empty;

    [StringLength(300)]
    public string? VerificationReference { get; set; } = null;
}
