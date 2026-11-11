// Purpose: the bishop's draft of one liturgical calendar version, entered exactly from the competent authority's source; never computed.
// Main members: OperationId, Version, Rite, Year, Source, VersionLabel, ValidFrom/ValidTo, AllowsParishExceptions, optional CorrectsCalendarId
// with CorrectionReason, and Entries.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveLiturgicalCalendarDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required, StringLength(120)]
    public string Rite { get; set; } = string.Empty;

    [Range(1900, 2200)]
    public int Year { get; set; }

    [Required, StringLength(500)]
    public string Source { get; set; } = string.Empty;

    [Required, StringLength(60)]
    public string VersionLabel { get; set; } = string.Empty;

    [Required]
    public DateOnly? ValidFrom { get; set; }

    [Required]
    public DateOnly? ValidTo { get; set; }

    [Required]
    public bool? AllowsParishExceptions { get; set; }

    public Guid? CorrectsCalendarId { get; set; } = null;

    [StringLength(1000)]
    public string? CorrectionReason { get; set; } = null;

    [Required]
    public LiturgicalEntryDto[] Entries { get; set; } = Array.Empty<LiturgicalEntryDto>();
}
