// Purpose: creates a giving campaign for a fund, or edits it (Version required when editing; the fund never changes).
// Main members: OperationId, Version, Name, NameAr, Purpose, PurposeAr, FundId, StartsOn, EndsOn and Targets.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class SaveCampaignDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(200)]
    public string? NameAr { get; set; } = null;

    [Required]
    [StringLength(1000)]
    public string Purpose { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? PurposeAr { get; set; } = null;

    [NotEmptyGuid]
    public Guid FundId { get; set; }

    public DateOnly StartsOn { get; set; }

    public DateOnly? EndsOn { get; set; } = null;

    [Required]
    public Dictionary<string, decimal> Targets { get; set; } = new();
}
