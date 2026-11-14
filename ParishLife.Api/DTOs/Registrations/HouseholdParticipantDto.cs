// Purpose: one household member's entry in a household registration: form answers, consent/guardian evidence and collection arrangements.
// Main members: PersonId, Transport, Answers, ConsentEvidence, GuardianAuthorityEvidence, Collectors and IndependentDeparture.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Models;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Registrations;

public class HouseholdParticipantDto
{
    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    public bool Transport { get; set; }

    [Required]
    public Dictionary<string, string> Answers { get; set; } = new();

    [StringLength(2000)]
    public string? ConsentEvidence { get; set; } = null;

    [StringLength(2000)]
    public string? GuardianAuthorityEvidence { get; set; } = null;

    [Required]
    [MaxLength(10)]
    public AuthorizedCollector[] Collectors { get; set; } = Array.Empty<AuthorizedCollector>();

    public bool IndependentDeparture { get; set; }
}
