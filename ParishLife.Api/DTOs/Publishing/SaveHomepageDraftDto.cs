// Purpose: saves the working platform homepage draft; languages may be incomplete until it is published.
// Main members: OperationId, Version (omit only for the first draft) and Content.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Publishing;

public class SaveHomepageDraftDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    public HomepageContentDto Content { get; set; } = new();
}
