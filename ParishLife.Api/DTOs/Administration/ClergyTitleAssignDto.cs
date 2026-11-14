// Purpose: a platform operator's assignment of one listed clergy title to an account, or its removal (ClergyTitleId null).
// Main members: OperationId, Version (null for the first assignment) and ClergyTitleId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Administration;

public class ClergyTitleAssignDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [NotEmptyGuid]
    public Guid? ClergyTitleId { get; set; } = null;
}
