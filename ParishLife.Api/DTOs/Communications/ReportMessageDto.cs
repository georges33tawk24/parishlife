// Purpose: lets a conversation participant report one exact message with their own explanation.
// Main members: OperationId and Explanation.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Communications;

public class ReportMessageDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(4000)]
    public string Explanation { get; set; } = string.Empty;
}
