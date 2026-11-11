// Purpose: the minimal public answer for a verification code: status, document type/reference, issuing parish, printed authority and
// an honest statement of whether the electronic authorization is official. No subject, contents, reasons or account identifiers.
// Main members: Code, Status, StatusMeaning, DocumentType, DocumentDetail, Reference, DocumentVersion, IssuingParish, AuthorizedBy,
// AuthorizedAt, ElectronicSignatureRecognized, OfficialStatement and CheckedAt.

namespace ParishLife.Api.DTOs.Documents;

public class DocumentVerificationDto
{
    public string Code { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string StatusMeaning { get; set; } = string.Empty;

    public string DocumentType { get; set; } = string.Empty;

    // The sacrament for a certificate; null for a letter.
    public string? DocumentDetail { get; set; } = null;

    public string Reference { get; set; } = string.Empty;

    public int DocumentVersion { get; set; }

    public string IssuingParish { get; set; } = string.Empty;

    public string AuthorizedBy { get; set; } = string.Empty;

    public DateTimeOffset AuthorizedAt { get; set; }

    public bool ElectronicSignatureRecognized { get; set; }

    public string OfficialStatement { get; set; } = string.Empty;

    public DateTimeOffset CheckedAt { get; set; }
}
