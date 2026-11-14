// Purpose: one preparation requirement as the priest types it when saving the parish list; at least one of the two labels is required.
// Main members: Key, Label and LabelAr.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Sacraments;

public class RequirementItemDto
{
    [Required]
    [RegularExpression("^[A-Za-z0-9_]{1,60}$")]
    public string Key { get; set; } = string.Empty;

    [StringLength(200)]
    public string? Label { get; set; } = null;

    [StringLength(200)]
    public string? LabelAr { get; set; } = null;
}
