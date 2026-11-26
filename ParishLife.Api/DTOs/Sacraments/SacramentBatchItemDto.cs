// Purpose: the outcome of a group sacrament request for one person: the case opened for them, or why none was.
// Main members: SubjectPersonId, Created, Record (the opened case when Created), ErrorCode and Message (when not created).

namespace ParishLife.Api.DTOs.Sacraments;

public class SacramentBatchItemDto
{
    public string SubjectPersonId { get; set; } = string.Empty;

    public bool Created { get; set; }

    public SacramentRecordDto? Record { get; set; } = null;

    // resource_not_found (not an active person of this parish) or invalid_sacrament_state (an active or registered case exists).
    public string? ErrorCode { get; set; } = null;

    public string? Message { get; set; } = null;
}
