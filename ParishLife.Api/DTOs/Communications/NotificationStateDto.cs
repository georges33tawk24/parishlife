// Purpose: marks the caller's own notification read, unread or archived.
// Main members: Status.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class NotificationStateDto
{
    [Required]
    [RegularExpression("^(Read|Unread|Archived)$")]
    public string Status { get; set; } = string.Empty;
}
