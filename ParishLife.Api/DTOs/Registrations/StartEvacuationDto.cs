// Purpose: starts an evacuation roll call for an event from the participants currently recorded present.
// Main members: OperationId, Kind (Drill or Emergency) and an optional Note.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class StartEvacuationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(20)]
    public string Kind { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Note { get; set; } = null;
}
