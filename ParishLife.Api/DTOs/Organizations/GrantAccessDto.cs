// Purpose: represents grant access input/output data.
// Main members: OperationId, Version, AccountId or Account (username or email), Allows, Denies, StartsAt, EndsAt, and related workflow details.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Organizations;

public class GrantAccessDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;
    public Guid AccountId { get; set; }

    [StringLength(254)]
    public string? Account { get; set; }
    [Required]
    public string[] Allows { get; set; } = Array.Empty<string>();
    [Required]
    public string[] Denies { get; set; } = Array.Empty<string>();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }
    [NotEmptyGuid]
    public Guid? DelegatingOrganizationId { get; set; } = null;
}
