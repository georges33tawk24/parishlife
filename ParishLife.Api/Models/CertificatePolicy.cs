// Purpose: records an archdiocese bishop's explicit choice about bishop acceptance of new certificates; without it, acceptance is required.
// Main members: RequireBishopAcceptance, Reason, ApprovedBy and ApprovedAt.

namespace ParishLife.Api.Models;

public class CertificatePolicy
{
    public bool RequireBishopAcceptance { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string ApprovedBy { get; set; } = string.Empty;

    public DateTimeOffset ApprovedAt { get; set; }
}
