// Purpose: requests an explicit end to one ministry leadership appointment without deleting its history.
// Main members: OperationId, Version and private administrative Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class EndMinistryLeaderDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
