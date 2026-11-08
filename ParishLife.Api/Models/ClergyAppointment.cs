// Purpose: records evidenced clergy authority independently from technical administrator privileges.
// Main functions: IsCurrent.

namespace ParishLife.Api.Models;

public class ClergyAppointment
{
    public string ParishId { get; set; } = string.Empty;

    public string AccountId { get; set; } = string.Empty;

    public string Role { get; set; } = string.Empty;

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public bool Revoked { get; set; }

    public string AppointedBy { get; set; } = string.Empty;

    public string EvidenceReference { get; set; } = string.Empty;

    public bool IsCurrent(DateTimeOffset now) => !Revoked && StartsAt <= now && (EndsAt is null || now < EndsAt);
}
