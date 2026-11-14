// Purpose: a platform operator's request to suspend or reinstate one account; it carries no credential.
// Main members: OperationId (idempotency), Version (the account's current version) and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Administration;

public class AccountStatusActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
