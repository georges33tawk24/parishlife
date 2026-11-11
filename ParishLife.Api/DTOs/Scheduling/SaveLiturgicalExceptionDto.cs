// Purpose: a priest's parish observance under an approved calendar that permits parish exceptions, with its reason and effective dates.
// Main members: OperationId, CalendarId, EffectiveFrom, EffectiveTo, Titles and Reason.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveLiturgicalExceptionDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [NotEmptyGuid]
    public Guid CalendarId { get; set; }

    [Required]
    public DateOnly? EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; } = null;

    [Required]
    public Dictionary<string, string> Titles { get; set; } = new();

    [Required, StringLength(1000)]
    public string Reason { get; set; } = string.Empty;
}
