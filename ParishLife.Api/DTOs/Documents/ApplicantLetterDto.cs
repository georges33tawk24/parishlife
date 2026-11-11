// Purpose: the applicant or guest view of a released or withdrawn letter; the text, signer and code appear only for a release to the
// applicant's verified account, and a tracking link never receives them.
// Main members: Reference, Version, Title, Language, Status, ReleasedAt, ReleaseMethod, Body, SignerName, VerificationCode and Statement.

namespace ParishLife.Api.DTOs.Documents;

public class ApplicantLetterDto
{
    public string Reference { get; set; } = string.Empty;

    public int Version { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Language { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset? ReleasedAt { get; set; } = null;

    public string? ReleaseMethod { get; set; } = null;

    public string? Body { get; set; } = null;

    public string? SignerName { get; set; } = null;

    public string? VerificationCode { get; set; } = null;

    public string Statement { get; set; } = string.Empty;
}
