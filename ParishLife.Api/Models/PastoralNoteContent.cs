// Purpose: holds the protected title and body of a pastoral note before encryption.
// Main members: Title and Body.

namespace ParishLife.Api.Models;

public class PastoralNoteContent
{
    public string Title { get; set; } = string.Empty;

    public string Body { get; set; } = string.Empty;
}
