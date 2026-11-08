// Purpose: represents revise form input/output data.
// Main members: OperationId, Version, Fields.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class ReviseFormDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;
    [Required]
    public RegistrationField[] Fields { get; set; } = Array.Empty<RegistrationField>();
}
