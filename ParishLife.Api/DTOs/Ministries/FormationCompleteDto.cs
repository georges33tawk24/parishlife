// Purpose: represents formation complete input/output data.
// Main members: OperationId, PersonId.

using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class FormationCompleteDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [NotEmptyGuid]
    public Guid PersonId { get; set; }
}
