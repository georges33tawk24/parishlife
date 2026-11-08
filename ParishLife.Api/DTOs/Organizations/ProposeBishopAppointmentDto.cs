// Purpose: carries operator-reviewed factual input for a first bishop invitation without accepting self-selected authority.
// Main members: OperationId, OrganizationVersion, AccountId, explicit effective/acceptance/review dates, evidence, and reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class ProposeBishopAppointmentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string OrganizationVersion { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid AccountId { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public DateTimeOffset AcceptBy { get; set; }

    public DateTimeOffset? ReviewDueAt { get; set; }

    [Required]
    [StringLength(500)]
    public string EvidenceReference { get; set; } = string.Empty;

    [Required]
    [StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
