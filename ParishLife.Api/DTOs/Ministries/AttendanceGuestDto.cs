// Purpose: requests one reviewed additional-person attendance row without creating an account, Person or ministry membership.
// Main members: OperationId, sheet Version, actual parish PersonId, explicit initial Status and protected identity-review reference/reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceGuestDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid PersonId { get; set; }

    [Required, StringLength(20), RegularExpression("^(Present|Late|Absent|Excused|NotExpected|NotRecorded)$")]
    public string Status { get; set; } = "NotRecorded";

    [Required, StringLength(1000)]
    public string IdentityReviewReference { get; set; } = string.Empty;

    [Required, StringLength(2000)]
    public string Reason { get; set; } = string.Empty;
}
