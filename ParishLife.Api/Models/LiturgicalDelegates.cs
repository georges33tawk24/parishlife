// Purpose: the accounts an archdiocese's bishop has named to prepare liturgical calendar drafts for him (owner decision, 21 November 2026:
// a delegate prepares, the bishop approves). Stored once per archdiocese.
// Main members: AccountIds, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.Models;

public class LiturgicalDelegates
{
    public List<string> AccountIds { get; set; } = [];

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
