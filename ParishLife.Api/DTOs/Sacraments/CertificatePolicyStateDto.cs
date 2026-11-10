// Purpose: returns an archdiocese's current certificate bishop-acceptance policy and who approved it.
// Main members: RequireBishopAcceptance, Reason, ApprovedBy and ApprovedAt.

namespace ParishLife.Api.DTOs.Sacraments;

public class CertificatePolicyStateDto
{
    public bool RequireBishopAcceptance { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string ApprovedBy { get; set; } = string.Empty;

    public DateTimeOffset ApprovedAt { get; set; }
}
