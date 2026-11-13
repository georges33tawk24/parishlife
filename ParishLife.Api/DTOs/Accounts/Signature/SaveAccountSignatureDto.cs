// Purpose: saves or replaces the holder's own signature image.
// Main members: OperationId (idempotent retry), Version (null for the first save, else the stored version), Drawing, Title and TitleAr.

using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts.Signature;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class SaveAccountSignatureDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(200)]
    public string? Version { get; set; } = null;

    [Required]
    [StringLength(60000)]
    [RegularExpression("^M[MLQ0-9 .\\-]*$")]
    public string Drawing { get; set; } = string.Empty;

    [StringLength(80)]
    public string? Title { get; set; } = null;

    [StringLength(80)]
    public string? TitleAr { get; set; } = null;
}
