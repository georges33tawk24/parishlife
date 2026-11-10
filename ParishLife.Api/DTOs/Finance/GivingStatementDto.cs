// Purpose: returns attributed, non-anonymous posted gifts for one person or household and year, with totals per currency.
// Main members: Year, PersonId, HouseholdId, Contributions, Totals and Notice.

namespace ParishLife.Api.DTOs.Finance;

public class GivingStatementDto
{
    public int Year { get; set; }

    public string? PersonId { get; set; } = null;

    public string? HouseholdId { get; set; } = null;

    public ContributionDto[] Contributions { get; set; } = Array.Empty<ContributionDto>();

    public Dictionary<string, decimal> Totals { get; set; } = new();

    public string Notice { get; set; } = "Record of gifts received by the parish; not a tax receipt or legal certificate.";
}
