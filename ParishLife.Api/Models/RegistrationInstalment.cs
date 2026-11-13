// Purpose: one dated part of an event fee schedule; the parish supplies dates and amounts, which sum to the fee.
// Main members: DueOn (the event's local date) and Amount in the policy's fee currency.

namespace ParishLife.Api.Models;

public class RegistrationInstalment
{
    public DateOnly DueOn { get; set; }

    public decimal Amount { get; set; }
}
