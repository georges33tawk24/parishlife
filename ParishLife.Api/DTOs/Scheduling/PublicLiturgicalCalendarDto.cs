// Purpose: the public liturgical read for a parish and date range. Status NotPublished means the parish's competent authority has no approved
// calendar here, never that there are no observances.
// Main members: ParishId, From, To, Status and Days.

namespace ParishLife.Api.DTOs.Scheduling;

public class PublicLiturgicalCalendarDto
{
    public string ParishId { get; set; } = string.Empty;

    public DateOnly From { get; set; }

    public DateOnly To { get; set; }

    public string Status { get; set; } = "NotPublished";

    public PublicLiturgicalDayDto[] Days { get; set; } = Array.Empty<PublicLiturgicalDayDto>();
}
