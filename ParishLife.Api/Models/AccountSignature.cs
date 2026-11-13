// Purpose: stores one account holder's own handwritten signature image, privately in their account partition.
// Main members: AccountId (the only owner and reader), Drawing (an SVG path on a 400 x 140 page), Title and TitleAr (the line shown under the
// name, each language as typed) and UpdatedAt. It is an image only: it signs nothing and is not an electronic signature (U05 is open).

namespace ParishLife.Api.Models;

public class AccountSignature
{
    public string AccountId { get; set; } = string.Empty;

    public string Drawing { get; set; } = string.Empty;

    public string? Title { get; set; } = null;

    public string? TitleAr { get; set; } = null;

    public DateTimeOffset UpdatedAt { get; set; }
}
