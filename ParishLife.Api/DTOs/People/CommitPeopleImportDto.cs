// Purpose: commits a staged people import, all rows or deliberately only the valid ones.
// Main members: OperationId, Version and ValidRowsOnly.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.People;

public class CommitPeopleImportDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    public bool ValidRowsOnly { get; set; }
}
