// Purpose: describes an eligible reviewer to a submitter without exposing the reviewer's account or contact data.
// Main members: Id, Description and Categories.

namespace ParishLife.Api.DTOs.Care;

public class ReviewerOptionDto
{
    public string Id { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string[] Categories { get; set; } = Array.Empty<string>();
}
