// Purpose: one language's plain text for a homepage block in a request or response.
// Main members: Title, Body and LinkLabel.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Publishing;

public class HomepageTextDto
{
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [StringLength(5000)]
    public string Body { get; set; } = string.Empty;

    [StringLength(80)]
    public string? LinkLabel { get; set; } = null;
}
