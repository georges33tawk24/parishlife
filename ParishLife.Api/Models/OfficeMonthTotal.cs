// Purpose: one currency's figures for a closed office month.
// Main members: Opening, In, Out and Closing.

namespace ParishLife.Api.Models;

public class OfficeMonthTotal
{
    public decimal Opening { get; set; }

    public decimal In { get; set; }

    public decimal Out { get; set; }

    public decimal Closing { get; set; }
}
