// Purpose: creates a parish fund, or edits its names and purpose (Version required when editing; the restriction never changes).
// Main members: OperationId, Version, Name, NameAr, Purpose, PurposeAr and Restricted.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveFundDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(200)]
    public string? NameAr { get; set; } = null;

    [Required]
    [StringLength(1000)]
    public string Purpose { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? PurposeAr { get; set; } = null;

    public bool Restricted { get; set; }
}
