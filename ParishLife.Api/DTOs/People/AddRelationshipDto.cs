// Purpose: records how a related person relates to a person; the mirror relationship is stored automatically.
// Main members: OperationId, RelatedPersonId, Kind, Source and EvidenceReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class AddRelationshipDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid RelatedPersonId { get; set; }

    [Required]
    [RegularExpression("^(Parent|Child|AdoptiveParent|AdoptiveChild|StepParent|StepChild|Spouse|Sibling|Guardian|Ward|Relative)$")]
    public string Kind { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Source { get; set; } = null;

    [StringLength(1000)]
    public string? EvidenceReference { get; set; } = null;
}
