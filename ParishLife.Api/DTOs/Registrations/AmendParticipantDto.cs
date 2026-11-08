// Purpose: represents amend participant input/output data.
// Main members: OperationId, Version, Transport, Answers, ConsentEvidence, GuardianAuthorityEvidence, Collectors, and related workflow details.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class AmendParticipantDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

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

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
