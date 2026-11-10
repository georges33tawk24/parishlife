// Purpose: returns the approved official numbering scheme of one sacrament register.
// Main members: Sacrament, Format, PerYear, ApprovalReference, ApprovedBy and ApprovedAt.

namespace ParishLife.Api.DTOs.Sacraments;

public class SacramentPolicyDto
{
    public string Sacrament { get; set; } = string.Empty;

    public string Format { get; set; } = string.Empty;

    public bool PerYear { get; set; }

    public string ApprovalReference { get; set; } = string.Empty;

    public string ApprovedBy { get; set; } = string.Empty;

    public DateTimeOffset ApprovedAt { get; set; }
}
