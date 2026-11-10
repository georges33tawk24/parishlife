// Purpose: records an independent verifier's observed totals for an exact session revision.
// Main members: OperationId, Version, Revision, Observed and Note.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Finance;

public class VerifySessionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public int Revision { get; set; }

    [Required]
    [MaxLength(40)]
    public CurrencyTotalDto[] Observed { get; set; } = Array.Empty<CurrencyTotalDto>();

    [StringLength(2000)]
    public string? Note { get; set; } = null;
}
