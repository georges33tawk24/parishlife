// Purpose: holds the next receipt number for one parish in one year (owner decision, 21 November 2026: numbers restart each year); it
// changes only in the transaction that creates the receipt with that number.
// Main members: ParishId, Year (0 for the single counter used before yearly numbering) and Next.

namespace ParishLife.Api.Models;

public class GiftReceiptCounter
{
    public string ParishId { get; set; } = string.Empty;

    public int Year { get; set; }

    public long Next { get; set; } = 1;
}
