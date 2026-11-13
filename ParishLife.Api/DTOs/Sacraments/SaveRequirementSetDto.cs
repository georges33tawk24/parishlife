// Purpose: saves the parish's own preparation requirement list for one sacrament (a priest's decision); an empty list clears it.
// Main members: OperationId, Version (the current list's version when one exists), Sacrament, Items and BlockSchedulingUntilMet.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class SaveRequirementSetDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [RegularExpression("^(Baptism|FirstCommunion|Confirmation|Marriage|Funeral|Anointing|Other)$")]
    public string Sacrament { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public List<RequirementItemDto> Items { get; set; } = new();

    public bool BlockSchedulingUntilMet { get; set; }
}
