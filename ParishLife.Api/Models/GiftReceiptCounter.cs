// Purpose: holds the next receipt number for one parish; it changes only in the transaction that creates the receipt with that number.
// Main members: ParishId and Next.

namespace ParishLife.Api.Models;

public class GiftReceiptCounter
{
    public string ParishId { get; set; } = string.Empty;

    public long Next { get; set; } = 1;
}
