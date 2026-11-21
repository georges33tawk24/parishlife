// Purpose: the result of one outside channel for one recipient.
// Members: Sent (the provider accepted it; not proof of receipt), Skipped (channel off, not chosen, or no address), Failed (worth a retry).

namespace ParishLife.Api.Models.Enums;

public enum DeliveryOutcome
{
    Sent,
    Skipped,
    Failed
}
