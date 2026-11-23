// Purpose: the office undoes a person record's link to a sign-in account (for example a link accepted by the wrong account), with a reason
// kept in the audit. The account and the record both stay; a new invitation can then be issued.
// Main members: OperationId, Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class UnlinkPersonAccountDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}
