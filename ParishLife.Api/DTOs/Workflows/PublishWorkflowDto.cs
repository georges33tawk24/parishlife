// Purpose: publishes exactly the reviewed working draft as a new immutable workflow version.
// Main members: OperationId and Version (the definition ETag the publisher reviewed).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Workflows;

public class PublishWorkflowDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;
}
