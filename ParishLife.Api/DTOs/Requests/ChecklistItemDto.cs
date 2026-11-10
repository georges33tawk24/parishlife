// Purpose: carries one checklist item when the office sets a checklist and in request responses.
// Main members: Key, Label, Required, Status, PaperReference, VerifiedBy and VerifiedAt.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class ChecklistItemDto
{
    [Required]
    [RegularExpression("^[a-z0-9][a-z0-9-]{0,39}$")]
    public string Key { get; set; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string Label { get; set; } = string.Empty;

    public bool Required { get; set; }

    [Required]
    [RegularExpression("^(Missing|Received|NotApplicable)$")]
    public string Status { get; set; } = "Missing";

    [StringLength(500)]
    public string? PaperReference { get; set; } = null;

    public string? VerifiedBy { get; set; } = null;

    public DateTimeOffset? VerifiedAt { get; set; } = null;
}
