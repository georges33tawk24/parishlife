// Purpose: requests one explicit versioned personal lifecycle transition without assignment or sharing fields.
// Main members: OperationId, Version and Action; actions are start, wait, complete, reopen, cancel, archive and restore.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class PersonalItemActionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }
    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;
    [Required, RegularExpression("^(start|wait|complete|reopen|cancel|archive|restore)$")]
    public string Action { get; set; } = string.Empty;
}
