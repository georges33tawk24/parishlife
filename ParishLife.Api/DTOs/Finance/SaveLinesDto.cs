// Purpose: replaces an open counting session's lines, creating a new revision.
// Main members: OperationId, Version and Lines.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveLinesDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [MaxLength(90)]
    public GiftLineDto[] Lines { get; set; } = Array.Empty<GiftLineDto>();
}
