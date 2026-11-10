// Purpose: shows who currently covers parish office work (zero, one or several secretaries) and what happens when nobody does.
// Main members: Holders, NoOfficeHolder and Fallback.

namespace ParishLife.Api.DTOs.Organizations;

public class OfficeCoverageDto
{
    public OfficeHolderDto[] Holders { get; set; } = Array.Empty<OfficeHolderDto>();

    public bool NoOfficeHolder { get; set; }

    public string Fallback { get; set; } = string.Empty;
}
