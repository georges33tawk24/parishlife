// Purpose: validates a reasoned attributed correction to a closed sheet without rewriting prior history.
// Main members: OperationId, Version, PersonId, RowVersion, Status, Reason, ReviewReference.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceCorrectDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [Required, StringLength(1024)]
    public string RowVersion { get; set; } = string.Empty;

    [Required, StringLength(20)]
    public string Status { get; set; } = string.Empty;

    [Required, StringLength(2000)]
    public string Reason { get; set; } = string.Empty;

    [Required, StringLength(1000)]
    public string ReviewReference { get; set; } = string.Empty;
}
