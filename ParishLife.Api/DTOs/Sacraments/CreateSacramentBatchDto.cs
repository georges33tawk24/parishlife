// Purpose: opens first communion or confirmation cases for several existing parish people at once, with the details they share
// (requested date, celebrant, church, notes as facts). Baptism and the other sacraments stay one person per request.
// Main members: OperationId (one per group; resending it returns the same results), Sacrament, SubjectPersonIds (1-90, distinct),
// Facts (shared by every case) and TentativeDate.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Sacraments;

public class CreateSacramentBatchDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(FirstCommunion|Confirmation)$")]
    public string Sacrament { get; set; } = string.Empty;

    [Required]
    [MinLength(1)]
    [MaxLength(90)]
    public Guid[] SubjectPersonIds { get; set; } = Array.Empty<Guid>();

    [Required]
    public Dictionary<string, string> Facts { get; set; } = new();

    [StringLength(200)]
    public string? TentativeDate { get; set; } = null;
}
