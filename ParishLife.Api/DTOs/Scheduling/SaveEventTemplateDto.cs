// Purpose: creates or edits a reusable event template; edits carry the stored version.
// Main members: OperationId, Version, Name, NameAr, Kind, Visibility, StartTime, DurationMinutes, Description and DescriptionAr.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveEventTemplateDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [StringLength(500)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string? NameAr { get; set; } = null;

    [Required]
    [RegularExpression("^(ParishActivity|Appointment|ResourceBlock)$")]
    public string Kind { get; set; } = "ParishActivity";

    [Required]
    [RegularExpression("^(Public|Parish|Private)$")]
    public string Visibility { get; set; } = "Parish";

    [RegularExpression("^([01][0-9]|2[0-3]):[0-5][0-9]$")]
    public string? StartTime { get; set; } = null;

    // Up to the 31 days a calendar event may span.
    [Range(1, 44640)]
    public int DurationMinutes { get; set; } = 60;

    [StringLength(10000)]
    public string? Description { get; set; } = null;

    [StringLength(10000)]
    public string? DescriptionAr { get; set; } = null;
}
