// Purpose: requests a member's own registration for an open parish activity, using their reviewed person link.
// Main members: OperationId, the viewed FormVersionId, Transport, Answers and optional ConsentEvidence supplied by the member.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class RegisterOwnDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid FormVersionId { get; set; }

    public bool Transport { get; set; }

    [Required]
    public Dictionary<string, string> Answers { get; set; } = new();

    [StringLength(2000)]
    public string? ConsentEvidence { get; set; } = null;
}
