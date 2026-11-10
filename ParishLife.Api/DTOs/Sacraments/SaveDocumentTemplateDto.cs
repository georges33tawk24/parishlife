// Purpose: proposes certificate wording for one sacrament and language, supplied by the competent authority.
// Main members: OperationId, Kind, Language and Body.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class SaveDocumentTemplateDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(Baptism|FirstCommunion|Confirmation|Marriage|Funeral|Anointing|Other)$")]
    public string Kind { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(en|fr|ar)$")]
    public string Language { get; set; } = string.Empty;

    [Required]
    [StringLength(20000)]
    public string Body { get; set; } = string.Empty;
}
