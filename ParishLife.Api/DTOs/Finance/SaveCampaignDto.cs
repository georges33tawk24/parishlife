// Purpose: creates a giving campaign for a fund.
// Main members: OperationId, Name, Purpose, FundId, StartsOn, EndsOn and Targets.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveCampaignDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(1000)]
    public string Purpose { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid FundId { get; set; }

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    [Required]
    public Dictionary<string, decimal> Targets { get; set; } = new();
}
