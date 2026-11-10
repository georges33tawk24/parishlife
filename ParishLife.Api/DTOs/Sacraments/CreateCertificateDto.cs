// Purpose: opens a certificate for a registered entry, a planned sacrament awaiting its entry, or a reissue of an earlier certificate.
// Main members: OperationId, Sacrament, SubjectPersonId, SourceRecordId, RequestId, Language, Quantity, Purpose, ReplacesCertificateId and ReissueReason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class CreateCertificateDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(Baptism|FirstCommunion|Confirmation|Marriage|Funeral|Anointing|Other)$")]
    public string Sacrament { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid SubjectPersonId { get; set; }

    [NotEmptyGuid]
    public Guid? SourceRecordId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? RequestId { get; set; } = null;

    [Required]
    [RegularExpression("^(en|fr|ar)$")]
    public string Language { get; set; } = "en";

    [Range(1, 20)]
    public int Quantity { get; set; } = 1;

    [StringLength(300)]
    public string? Purpose { get; set; } = null;

    [NotEmptyGuid]
    public Guid? ReplacesCertificateId { get; set; } = null;

    [StringLength(2000)]
    public string? ReissueReason { get; set; } = null;
}
