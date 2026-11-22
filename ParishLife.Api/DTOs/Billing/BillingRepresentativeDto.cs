// Purpose: who acts for an archdiocese in billing.
// Main members: AccountId, DisplayName, Named (false while the registering account still acts because nobody was named) and Version (the
// archdiocese record's version, for the next change).

namespace ParishLife.Api.DTOs.Billing;

public class BillingRepresentativeDto
{
    public string AccountId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public bool Named { get; set; }

    public string Version { get; set; } = string.Empty;
}
