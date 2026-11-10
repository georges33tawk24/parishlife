// Purpose: moves a departing office holder's open request cases to another office holder.
// Main members: OperationId, FromAccountId and ToAccountId.

using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class OfficeHandoverDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid FromAccountId { get; set; }

    [NotEmptyGuid]
    public Guid ToAccountId { get; set; }
}
