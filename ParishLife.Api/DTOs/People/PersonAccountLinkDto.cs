// Purpose: which person records are linked to a sign-in account, for the office (so it can unlink a wrong link or invite an unlinked person).
// Main members: PersonId, AccountId, DisplayName.

namespace ParishLife.Api.DTOs.People;

public class PersonAccountLinkDto
{
    public string PersonId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;
}
