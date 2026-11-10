// Purpose: sends a message in an existing conversation.
// Main members: OperationId and Body.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class PostInboxMessageDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(10000)]
    public string Body { get; set; } = string.Empty;
}
