// Purpose: starts a conversation: with the parish office (members), or directly with a linked parishioner (office staff), named either by the
// parishioner's account id or by the person record the office sees in its people list.
// Main members: OperationId, Subject (optional: the first line of the message names a new chat), Body, RecipientAccountId and RecipientPersonId
// (at most one of the two). A chat with the same people already exists: the message is added to it (one chat per person, as in a chat app).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class StartConversationDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(300)]
    public string? Subject { get; set; } = string.Empty;

    [Required]
    [StringLength(10000)]
    public string Body { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid? RecipientAccountId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? RecipientPersonId { get; set; } = null;
}
