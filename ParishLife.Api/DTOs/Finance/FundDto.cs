// Purpose: returns a fund.
// Main members: Id, Name, Purpose, Restricted and Status.

namespace ParishLife.Api.DTOs.Finance;

public class FundDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public bool Restricted { get; set; }

    public string Status { get; set; } = string.Empty;
}
