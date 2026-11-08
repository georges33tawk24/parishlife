// Purpose: represents create invoice input/output data.
// Main members: OperationId, PlanId, StartsAt.

using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Billing;

public class CreateInvoiceDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [NotEmptyGuid]
    public Guid PlanId { get; set; }

    public DateTimeOffset StartsAt { get; set; }
}
