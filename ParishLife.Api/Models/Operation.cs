// Purpose: binds an idempotent command to its actor, input fingerprint, scope, and recorded instant.
// Main functions: Create.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ParishLife.Api.Models;

public class Operation
{
    public string Id { get; set; } = string.Empty;

    public string ActorId { get; set; } = string.Empty;

    public string Fingerprint { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }

    public string? ActingAppointmentId { get; set; }

    public static Operation Create(Guid id, string actorId, object request, TimeProvider clock, string? scope = null, string? actingAppointmentId = null)
    {
        var type = request.GetType().Name.StartsWith("<>", StringComparison.Ordinal) ? "context" : OperationContractNames.For(request.GetType());
        var input = actorId + "\n" + type + "\n" + scope + "\n" + JsonSerializer.Serialize(request);
        if (actingAppointmentId is not null)
            input += "\nacting-appointment:" + actingAppointmentId;
        var bytes = Encoding.UTF8.GetBytes(input);
        return new Operation
        {
            Id = Guard.Id(id),
            ActorId = actorId,
            Fingerprint = Convert.ToHexString(SHA256.HashData(bytes)),
            At = clock.GetUtcNow(),
            ActingAppointmentId = actingAppointmentId
        };
    }
}
