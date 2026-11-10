// Purpose: represents register participant input/output data.
// Main members: OperationId, PersonId, the viewed FormVersionId, answers, transport, consent and guardian arrangements.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class RegisterParticipantDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [NotEmptyGuid]
    public Guid FormVersionId { get; set; }

    public bool Transport { get; set; }
    [Required]
    public Dictionary<string, string> Answers { get; set; } = new();

    [StringLength(500)]
    public string? ConsentEvidence { get; set; }

    [StringLength(500)]
    public string? GuardianAuthorityEvidence { get; set; }
    [Required]
    public AuthorizedCollector[] Collectors { get; set; } = Array.Empty<AuthorizedCollector>();

    public bool IndependentDeparture { get; set; }
}
