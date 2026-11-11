// Purpose: default contact-code channel while no email/SMS provider is approved and configured; it sends nothing and says so.
// Main members: Configured is false; SendAsync returns false without contacting anyone.

using ParishLife.Api.Interfaces.Services.Accounts;

namespace ParishLife.Api.Services.Accounts;

public class UnconfiguredContactCodeDelivery : IContactCodeDelivery
{
    public bool Configured => false;

    public Task<bool> SendAsync(string email, string code, string purpose, CancellationToken ct) => Task.FromResult(false);
}
