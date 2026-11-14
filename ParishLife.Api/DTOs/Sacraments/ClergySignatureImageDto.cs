// Purpose: describes a priest's current signature image (never its bytes) and states plainly that it is not an electronic signature.
// Main members: HasImage, Id, Version (of the pointer, for removal), ContentType, Size, Sha256, UploadedAt and Statement.

namespace ParishLife.Api.DTOs.Sacraments;

public class ClergySignatureImageDto
{
    public bool HasImage { get; set; }

    public string? Id { get; set; } = null;

    public string? Version { get; set; } = null;

    public string? ContentType { get; set; } = null;

    public long Size { get; set; }

    public string? Sha256 { get; set; } = null;

    public DateTimeOffset? UploadedAt { get; set; } = null;

    public string Statement { get; set; } = "An image of a handwritten signature for printing on paper; it is not an electronic signature and proves no approval.";
}
