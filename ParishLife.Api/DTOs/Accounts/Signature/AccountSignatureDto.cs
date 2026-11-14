// Purpose: returns the holder's own stored signature image to the holder only.
// Main members: Drawing (SVG path on a 400 x 140 page), Title, TitleAr and UpdatedAt.

namespace ParishLife.Api.DTOs.Accounts.Signature;

public class AccountSignatureDto
{
    public string Drawing { get; set; } = string.Empty;

    public string? Title { get; set; } = null;

    public string? TitleAr { get; set; } = null;

    public DateTimeOffset UpdatedAt { get; set; }
}
