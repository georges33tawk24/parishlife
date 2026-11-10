// Purpose: revises an unsigned letter draft at its current version.
// Main members: OperationId, Version, Title, Body and AddresseeName.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Documents;

public class ReviseLetterDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(8000)]
    public string Body { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string AddresseeName { get; set; } = string.Empty;
}
