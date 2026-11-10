// Purpose: saves the working draft of a website section; languages may be partial until it is submitted.
// Main members: OperationId, Version and Texts (keys en, fr, ar).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Publishing;

public class SaveWebsiteDraftDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    public Dictionary<string, WebsiteTextDto> Texts { get; set; } = new();
}
