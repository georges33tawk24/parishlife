// Purpose: hands a parish's control to its priest (owner decision, 23 November 2026), named by username or email.
// Main members: OperationId, Version (the parish's), Account.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class HandOverParishControlDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(254)]
    public string Account { get; set; } = string.Empty;
}
