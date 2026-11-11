// Purpose: neutral public outcome of a contact-verification request or confirmation.
// Main members: Status and Delivery (NotConfigured or Accepted by the provider; never a claim of receipt).

namespace ParishLife.Api.DTOs.Accounts;

public class ContactVerificationStatusDto
{
    public string Status { get; set; } = string.Empty;

    public string Delivery { get; set; } = string.Empty;
}
