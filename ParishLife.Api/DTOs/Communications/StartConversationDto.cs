// Purpose: starts a conversation: with the parish office (members), or directly with a linked parishioner (office staff).
// Main members: OperationId, Subject, Body and RecipientAccountId.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class StartConversationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(300)]
    public string Subject { get; set; } = string.Empty;

    [Required]
    [StringLength(10000)]
    public string Body { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? RecipientAccountId { get; set; } = null;
}
