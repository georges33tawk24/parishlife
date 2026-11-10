// Purpose: books a quantity of equipment for one calendar event.
// Main members: OperationId, EventId and Quantity.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class BookEquipmentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid EventId { get; set; }

    [Range(1, 100000)]
    public int Quantity { get; set; }
}
