// Purpose: one clergy member on a parish's public page, drawn from a current accepted priest appointment (never typed by the parish).
// Main members: Name (the appointed account's display name) and Role (ParishPriest for the designated head, otherwise Priest).

namespace ParishLife.Api.DTOs.Publishing;

public class PublicClergyDto
{
    public string Name { get; set; } = string.Empty;

    public string Role { get; set; } = "Priest";
}
