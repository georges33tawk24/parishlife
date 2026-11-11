// Purpose: records, corrects or clears a parish's verified map coordinates. Latitude and longitude are given together with their source,
// or both omitted to clear the location.
// Main members: OperationId, Version, Latitude, Longitude and SourceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class SetParishLocationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Range(-90, 90)]
    public decimal? Latitude { get; set; } = null;

    [Range(-180, 180)]
    public decimal? Longitude { get; set; } = null;

    [StringLength(500)]
    public string? SourceReference { get; set; } = null;
}
