// Purpose: sets whether new certificates in the bishop's archdiocese need bishop acceptance.
// Main members: OperationId, RequireBishopAcceptance and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class CertificatePolicyDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    public bool RequireBishopAcceptance { get; set; }

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
