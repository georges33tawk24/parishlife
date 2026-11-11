// Purpose: boundary for delivering one-use contact-ownership codes through a real provider (U10); none is configured yet.
// Main members: Configured reports whether a real channel exists; SendAsync returns true only when the provider accepted the message
// (acceptance is not proof of receipt). Implementations must never log or persist the code.

namespace ParishLife.Api.Interfaces.Services.Accounts;

public interface IContactCodeDelivery
{
    bool Configured { get; }

    Task<bool> SendAsync(string email, string code, string purpose, CancellationToken ct);
}
