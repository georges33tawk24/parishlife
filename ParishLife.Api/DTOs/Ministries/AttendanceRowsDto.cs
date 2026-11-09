// Purpose: returns a complete-sheet summary and one paged row subset under a stable sheet version.
// Main members: Sheet, Items, ContinuationToken.

namespace ParishLife.Api.DTOs.Ministries;

public class AttendanceRowsDto
{
    public ParishLife.Api.Models.Versioned<AttendanceSheetDto> Sheet { get; set; } = new();

    public IReadOnlyList<ParishLife.Api.Models.Versioned<AttendanceValueDto>> Items { get; set; } = Array.Empty<ParishLife.Api.Models.Versioned<AttendanceValueDto>>();

    public string? ContinuationToken { get; set; }
}
