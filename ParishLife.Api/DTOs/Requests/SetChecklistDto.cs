// Purpose: replaces a request's evidence checklist, recording received paper evidence with its verifier.
// Main members: OperationId, Version and Items.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class SetChecklistDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [MaxLength(40)]
    public ChecklistItemDto[] Items { get; set; } = Array.Empty<ChecklistItemDto>();
}
