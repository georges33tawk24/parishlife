// Purpose: one opening or closing checklist step as the office types it; the API records who ticked it and when.
// Main members: Phase, Label, LabelAr and Done.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveChecklistItemDto
{
    [Required]
    [RegularExpression("^(Opening|Closing)$")]
    public string Phase { get; set; } = "Opening";

    [Required]
    [StringLength(200)]
    public string Label { get; set; } = string.Empty;

    [StringLength(200)]
    public string? LabelAr { get; set; } = null;

    public bool Done { get; set; }
}
