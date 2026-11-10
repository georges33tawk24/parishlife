// Purpose: merges a duplicate person into a survivor with an explicit choice for every differing field.
// Main members: OperationId, SurvivorId, SourceId, Choices (field -> survivor|source) and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class MergePeopleDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid SurvivorId { get; set; }

    [NotEmptyGuid]
    public Guid SourceId { get; set; }

    public Dictionary<string, string> Choices { get; set; } = new();

    [Required]
    [StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
