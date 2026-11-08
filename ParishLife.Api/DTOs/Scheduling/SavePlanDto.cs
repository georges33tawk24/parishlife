// Purpose: represents save plan input/output data.
// Main members: OperationId, Version, EventId, Title, Items.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SavePlanDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; }
    [NotEmptyGuid]
    public Guid EventId { get; set; }

    [Required]
    [StringLength(500)]
    public string Title { get; set; } = string.Empty;
    [Required]
    public ServicePlanItem[] Items { get; set; } = Array.Empty<ServicePlanItem>();
}
