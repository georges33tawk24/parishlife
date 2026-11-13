// Purpose: asks the parish office to open the downstream record an accepted request needs (a sacramental case or a certificate)
// through the existing sacrament/certificate services, and link it to the case.
// Main members: OperationId, Version, RecordKind, Sacrament, Facts, TentativeDate, SourceRecordId, Language, Quantity and Purpose.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class OpenRequestRecordDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    // SacramentalCase (for a SacramentInquiry) or Certificate (for a Certificate request).
    [Required]
    [RegularExpression("^(SacramentalCase|Certificate)$")]
    public string RecordKind { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Baptism|FirstCommunion|Confirmation|Marriage|Funeral|Anointing|Other)$")]
    public string Sacrament { get; set; } = string.Empty;

    // Sacramental case only: facts copied as the office confirms them; nothing is filled in automatically.
    public Dictionary<string, string>? Facts { get; set; } = null;

    [StringLength(200)]
    public string? TentativeDate { get; set; } = null;

    // Certificate only: the subject's registered entry, when the office has found it.
    [NotEmptyGuid]
    public Guid? SourceRecordId { get; set; } = null;

    [RegularExpression("^(en|fr|ar)$")]
    public string Language { get; set; } = "en";

    [Range(1, 20)]
    public int Quantity { get; set; } = 1;

    [StringLength(300)]
    public string? Purpose { get; set; } = null;
}
