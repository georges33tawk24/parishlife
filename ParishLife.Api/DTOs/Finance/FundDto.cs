// Purpose: returns a fund with its Arabic twins and the version used to edit its names.
// Main members: Id, Version, Name, NameAr, Purpose, PurposeAr, Restricted and Status.

namespace ParishLife.Api.DTOs.Finance;

public class FundDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public string Purpose { get; set; } = string.Empty;

    public string? PurposeAr { get; set; } = null;

    public bool Restricted { get; set; }

    public string Status { get; set; } = string.Empty;
}
