// Purpose: replaces a reservation's descriptive details, which never change its period, rooms or allocation state.
// Main members: OperationId, Version, Purpose, PurposeAr, ExpectedAttendance, ContactPhone, Notes and Checklist.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Scheduling;

public class SaveReservationDetailsDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Purpose { get; set; } = null;

    [StringLength(500)]
    public string? PurposeAr { get; set; } = null;

    [Range(0, 100000)]
    public int? ExpectedAttendance { get; set; } = null;

    [StringLength(50)]
    public string? ContactPhone { get; set; } = null;

    [StringLength(2000)]
    public string? Notes { get; set; } = null;

    [Required]
    [MaxLength(40)]
    public SaveChecklistItemDto[] Checklist { get; set; } = Array.Empty<SaveChecklistItemDto>();
}
