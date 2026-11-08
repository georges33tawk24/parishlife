// Purpose: represents authorized collector business state and rules.
// Main members: Id, Name, AuthorityEvidence.

namespace ParishLife.Api.Models;

public class AuthorizedCollector
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string AuthorityEvidence { get; set; } = string.Empty;
}
