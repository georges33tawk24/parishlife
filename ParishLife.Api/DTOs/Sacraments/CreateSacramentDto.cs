// Purpose: opens a sacramental case for an existing parish person, optionally linked to the request that started it.
// Main members: OperationId, Sacrament, SubjectPersonId, RequestId, Facts and TentativeDate.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class CreateSacramentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(Baptism|FirstCommunion|Confirmation|Marriage|Funeral|Anointing|Other)$")]
    public string Sacrament { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid SubjectPersonId { get; set; }

    [NotEmptyGuid]
    public Guid? RequestId { get; set; } = null;

    [Required]
    public Dictionary<string, string> Facts { get; set; } = new();

    [StringLength(200)]
    public string? TentativeDate { get; set; } = null;
}
