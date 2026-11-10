// Purpose: submits or shows a personal data closure request.
// Main members: OperationId, Id, Version, Details, Status, SubmittedAt, Reason, Outcome and DecidedAt.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class DataClosureRequestDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Details { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset SubmittedAt { get; set; }

    public string? Reason { get; set; }

    public string[] Outcome { get; set; } = Array.Empty<string>();

    public DateTimeOffset? DecidedAt { get; set; }
}
