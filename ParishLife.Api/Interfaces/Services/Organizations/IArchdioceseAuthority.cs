// Purpose: checks the current actor's actual accepted bishop appointment independently of platform or office roles.
// Main functions: RequireBishopAsync enforces current authority; RequireBishopAppointmentAsync returns the exact authoritative office for scoped audit.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Services.Organizations;

public interface IArchdioceseAuthority
{
    Task RequireBishopAsync(string archdioceseId, CancellationToken ct);

    Task<Versioned<BishopAppointment>> RequireBishopAppointmentAsync(string archdioceseId, CancellationToken ct);
}
