// Purpose: reads or updates the caller's optional notification choices.
// Main members: MutedTopics, Language, DigestOptional, and the outside channels Email, Push and WhatsApp. On a save, a channel left out
// (null) keeps its stored value, so screens that only change topics never switch a channel off.

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

    public bool? Email { get; set; } = null;

    public bool? Push { get; set; } = null;

    public bool? WhatsApp { get; set; } = null;
}
