// Purpose: the bishop's list of calendar delegates, replacing the previous list.
// Main members: OperationId, Version (null for the first list) and Accounts: up to 10 usernames or sign-in emails. Each named account must be
// active, verified and use an authenticator.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveLiturgicalDelegatesDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(200)]
    public string? Version { get; set; } = null;

    [Required, MaxLength(10)]
    public List<string> Accounts { get; set; } = [];
}
