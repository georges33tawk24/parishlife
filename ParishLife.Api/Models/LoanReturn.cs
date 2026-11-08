// Purpose: represents loan return business state and rules.
// Main members: Id, LoanId, Quantity, Condition, ReceivedBy, At.

namespace ParishLife.Api.Models;

public class LoanReturn
{
    public string Id { get; set; } = string.Empty;

    public string LoanId { get; set; } = string.Empty;

    public int Quantity { get; set; }

    public string Condition { get; set; } = string.Empty;

    public string ReceivedBy { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
