// Purpose: represents ministry loan business state and rules.
// Main members: Id, MinistryId, StockId, PersonId, Quantity, Returned, BorrowedAt, and related workflow details.

namespace ParishLife.Api.Models;

public class MinistryLoan
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string StockId { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public int Returned { get; set; }

    public DateTimeOffset BorrowedAt { get; set; }

    public DateTimeOffset DueAt { get; set; }

    public string IssuedBy { get; set; } = string.Empty;

    public string Condition { get; set; } = string.Empty;
}
