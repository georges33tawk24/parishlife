// Purpose: Declares the ICurrentActor boundary used by backend services without exposing provider implementation
// details.
// Main members: AccountId identifies the principal; ActingAppointmentId identifies the optional explicit request capacity.

namespace ParishLife.Api.Interfaces.Services.Common;

public interface ICurrentActor
{
    string AccountId { get; }

    string? ActingAppointmentId { get; }
}
