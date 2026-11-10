// Purpose: one homepage block in a request or response; a story's Id is its stable lowercase key.
// Main members: Id, Texts (keys en, fr, ar) and LinkUrl (https or a site-relative path).

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Publishing;

public class HomepageBlockDto
{
    [StringLength(40)]
    public string Id { get; set; } = string.Empty;

    [Required]
    public Dictionary<string, HomepageTextDto> Texts { get; set; } = new();

    [StringLength(500)]
    public string? LinkUrl { get; set; } = null;
}
