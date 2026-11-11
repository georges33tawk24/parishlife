// Purpose: completes a staged email change with the code delivered to the new address and fresh credential proof.
// Main members: OperationId, ChangeId, Code, CurrentPassword, CurrentCode; secrets never enter operation metadata or audit.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts;

public class ConfirmEmailChangeDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid ChangeId { get; set; }

    [Required, StringLength(12, MinimumLength = 6)]
    public string Code { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [StringLength(12, MinimumLength = 6)]
    public string? CurrentCode { get; set; }
}
