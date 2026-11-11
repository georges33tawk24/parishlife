// Purpose: drafts an office letter for one request case, or a replacement version of an earlier signed letter.
// Main members: OperationId, Title, Body, Language, AddresseeName, ReplacesLetterId and ReplaceReason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Documents;

public class CreateLetterDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [StringLength(8000)]
    public string Body { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(en|fr|ar)$")]
    public string Language { get; set; } = "en";

    [Required]
    [StringLength(200)]
    public string AddresseeName { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? ReplacesLetterId { get; set; } = null;

    [StringLength(2000)]
    public string? ReplaceReason { get; set; } = null;
}
