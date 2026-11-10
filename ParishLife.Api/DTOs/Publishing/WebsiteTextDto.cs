// Purpose: one language version of a website section in requests and responses.
// Main members: Title and Body.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Publishing;

public class WebsiteTextDto
{
    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(20000)]
    public string Body { get; set; } = string.Empty;
}
