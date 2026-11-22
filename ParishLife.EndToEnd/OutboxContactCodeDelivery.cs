// Purpose: the test inbox of the test-only host. Instead of emailing, each sign-up, email-change or password-reset code is appended as
// one JSON line to a file beside the run's manifest, which the runner deletes with the run; the browser tests read the code from there,
// as a person reads their email. Nothing is ever sent. Codes are synthetic and live only for one isolated run. Test-only; never deployed.
// Main members: Configured (true, so the portal offers verification and password reset), SendAsync (appends email, purpose and code).

using System.Text.Json;
using ParishLife.Api.Interfaces.Services.Accounts;

namespace ParishLife.EndToEnd;

public class OutboxContactCodeDelivery(string path) : IContactCodeDelivery
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public bool Configured => true;

    public async Task<bool> SendAsync(string email, string code, string purpose, CancellationToken ct)
    {
        await Gate.WaitAsync(ct);
        try
        {
            await File.AppendAllTextAsync(path, JsonSerializer.Serialize(new { email, purpose, code }) + "\n", ct);
        }
        finally
        {
            Gate.Release();
        }
        return true;
    }
}
