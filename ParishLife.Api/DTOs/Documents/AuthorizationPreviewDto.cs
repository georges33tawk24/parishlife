// Purpose: shows the signer the exact canonical content and hash that an electronic authorization would bind.
// Main members: DocumentType, DocumentId, Reference, Version, Content, ContentHash, CurrentCode and Statement.

namespace ParishLife.Api.DTOs.Documents;

public class AuthorizationPreviewDto
{
    public string DocumentType { get; set; } = string.Empty;

    public string DocumentId { get; set; } = string.Empty;

    public string Reference { get; set; } = string.Empty;

    public int Version { get; set; }

    public Dictionary<string, string> Content { get; set; } = new();

    public string ContentHash { get; set; } = string.Empty;

    // The current authorization's verification code, if this version is already authorized.
    public string? CurrentCode { get; set; } = null;

    public string Statement { get; set; } = string.Empty;
}
