// Purpose: names one account that may currently be chosen as a Liturgy plan's celebrant (a current priest of the parish).
// Main members: AccountId; the display name comes from the shared account-names lookup, not from this DTO.

namespace ParishLife.Api.DTOs.Scheduling;

public class PlanCelebrantDto
{
    public string AccountId { get; set; } = string.Empty;
}
