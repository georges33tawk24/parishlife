// Purpose: one account the bishop named to prepare liturgical calendar drafts.
// Main members: AccountId and DisplayName.

namespace ParishLife.Api.DTOs.Scheduling;

public class LiturgicalDelegateDto
{
    public string AccountId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;
}
