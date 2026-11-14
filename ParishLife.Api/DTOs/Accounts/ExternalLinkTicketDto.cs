// Purpose: returns a short-lived, protected ticket that lets the browser start linking an external provider with a plain form post,
// after the fresh password (and authenticator) proof was checked over JSON.
// Main members: Ticket (opaque; bound to the account, this session, its security stamp and the provider) and ExpiresAt.

namespace ParishLife.Api.DTOs.Accounts;

public class ExternalLinkTicketDto
{
    public string Ticket { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }
}
