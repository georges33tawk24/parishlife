// Purpose: reads or updates the caller's optional notification choices.
// Main members: MutedTopics, Language and DigestOptional.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class NotificationPreferencesDto
{
    [Required]
    [MaxLength(30)]
    public string[] MutedTopics { get; set; } = Array.Empty<string>();

    [Required]
    [RegularExpression("^(en|fr|ar)$")]
    public string Language { get; set; } = "en";

    public bool DigestOptional { get; set; }
}
