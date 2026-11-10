// Purpose: carries one counted receipt when saving session lines and in responses.
// Main members: Key, Amount, Currency, Method, FundId, CampaignId, PersonId, EnvelopeId, Anonymous, Reference, HouseholdId and Unattributed.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class GiftLineDto
{
    [Required]
    [RegularExpression("^[a-z0-9][a-z0-9-]{0,39}$")]
    public string Key { get; set; } = string.Empty;

    [Range(typeof(decimal), "0.01", "1000000000000")]
    public decimal Amount { get; set; }

    [Required]
    [RegularExpression("^[A-Z]{3}$")]
    public string Currency { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Cash|Bank|Cheque|Card|Other)$")]
    public string Method { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid FundId { get; set; }

    [NotEmptyGuid]
    public Guid? CampaignId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;

    [StringLength(40)]
    public string? EnvelopeId { get; set; } = null;

    public bool Anonymous { get; set; }

    [StringLength(200)]
    public string? Reference { get; set; } = null;

    // Resolved by the server.
    public string? HouseholdId { get; set; } = null;

    public bool Unattributed { get; set; }
}
