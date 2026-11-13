// Purpose: updates the free-text usual meeting times of a draft or active ministry without reopening its approved description.
// Main members: OperationId, Version, MeetingTimes and its Arabic twin MeetingTimesAr (either may be empty to clear it).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Ministries;

public class SaveMeetingTimesDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [StringLength(300)]
    public string? MeetingTimes { get; set; }

    [StringLength(300)]
    public string? MeetingTimesAr { get; set; }
}
