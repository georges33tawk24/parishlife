// Purpose: asks a parish office to review membership and link the account to the right Person.
// Main members: OperationId, GivenName, FamilyName, BirthDate, Contact, Locality and Note.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class RequestMembershipDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(100)]
    public string GivenName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; } = null;

    [StringLength(300)]
    public string? Contact { get; set; } = null;

    [StringLength(200)]
    public string? Locality { get; set; } = null;

    [StringLength(1000)]
    public string? Note { get; set; } = null;
}
