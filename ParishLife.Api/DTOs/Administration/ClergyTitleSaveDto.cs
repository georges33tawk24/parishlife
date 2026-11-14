// Purpose: creates (no Version) or changes (current Version) one clergy title; either language may be typed, neither is derived from the other.
// Main members: OperationId, Version, Title, TitleAr and Retired.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Administration;

public class ClergyTitleSaveDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [StringLength(120)]
    public string? Title { get; set; } = null;

    [StringLength(120)]
    public string? TitleAr { get; set; } = null;

    public bool Retired { get; set; } = false;
}
