// Purpose: the bishop names the account that acts for the archdiocese in billing (payer transfers, sponsored invoices).
// Main members: OperationId, Version (the archdiocese record's current version) and Account (the username or sign-in email of an active,
// verified account that uses an authenticator).

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Billing;

public class SetBillingRepresentativeDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required, StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required, StringLength(254)]
    public string Account { get; set; } = string.Empty;
}
