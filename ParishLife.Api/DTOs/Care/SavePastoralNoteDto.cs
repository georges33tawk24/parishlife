// Purpose: creates or edits a pastoral note or task with its explicit audience; Version is required when editing.
// Main members: OperationId, Version, Kind, Title, Body, Category, PersonId, Visibility, SharedWithAccountId, AssigneeAccountId, Priority and DueAt.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Care;

public class SavePastoralNoteDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [StringLength(1024)]
    public string? Version { get; set; } = null;

    [Required]
    [RegularExpression("^(Note|Task)$")]
    public string Kind { get; set; } = "Note";

    [Required]
    [StringLength(300)]
    public string Title { get; set; } = string.Empty;

    [StringLength(20000)]
    public string Body { get; set; } = string.Empty;

    [StringLength(100)]
    public string? Category { get; set; } = null;

    [NotEmptyGuid]
    public Guid? PersonId { get; set; } = null;

    [Required]
    [RegularExpression("^(Author|ParishPriests|NamedPriest)$")]
    public string Visibility { get; set; } = "Author";

    [NotEmptyGuid]
    public Guid? SharedWithAccountId { get; set; } = null;

    [NotEmptyGuid]
    public Guid? AssigneeAccountId { get; set; } = null;

    [RegularExpression("^(Low|Normal|High)$")]
    public string? Priority { get; set; } = null;

    public DateTimeOffset? DueAt { get; set; } = null;
}
