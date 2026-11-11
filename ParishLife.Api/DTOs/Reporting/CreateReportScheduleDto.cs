// Purpose: creates the caller's own schedule for in-app delivery of a report snapshot (currently the parish work overview).
// Main members: OperationId, Report, ParishId, Frequency, DayOfWeek, LocalHour, TimeZone and Email (recorded as not configured, never sent).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Reporting;

public class CreateReportScheduleDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(40)]
    public string Report { get; set; } = string.Empty;

    [NotEmptyGuid]
    public Guid ParishId { get; set; }

    [Required, StringLength(10)]
    public string Frequency { get; set; } = string.Empty;

    [StringLength(10)]
    public string? DayOfWeek { get; set; } = null;

    [Range(0, 23)]
    public int LocalHour { get; set; }

    [Required, StringLength(64)]
    public string TimeZone { get; set; } = string.Empty;

    public bool Email { get; set; }
}
